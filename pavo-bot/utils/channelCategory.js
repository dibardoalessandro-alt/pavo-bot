const { ChannelType } = require('discord.js');

const DISCORD_MAX_CHANNELS_PER_CATEGORY = 50;

function countChildren(guild, categoryId) {
  return guild.channels.cache.filter(ch => ch.parentId === categoryId).size;
}

function isCategoryFullError(err) {
  if (!err) return false;
  if (err.code === 30013) return true; // Maximum number of channels in category reached (50)
  const msg = String(err.message || '');
  return msg.includes('Maximum number of channels in category') || msg.includes('50');
}

/**
 * Finds an existing overflow category (`<BaseName> (N)`) with free slots,
 * or creates a new one mirroring the base category's permissions.
 */
async function getOrCreateOverflowCategory(guild, baseCategory) {
  const escapedName = baseCategory.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const overflowPattern = new RegExp(`^${escapedName}\\s*\\((\\d+)\\)$`);

  const existingOverflows = guild.channels.cache
    .filter(ch => ch.type === ChannelType.GuildCategory && overflowPattern.test(ch.name))
    .sort((a, b) => {
      const numA = parseInt(a.name.match(overflowPattern)[1], 10);
      const numB = parseInt(b.name.match(overflowPattern)[1], 10);
      return numA - numB;
    });

  for (const cat of existingOverflows.values()) {
    if (countChildren(guild, cat.id) < DISCORD_MAX_CHANNELS_PER_CATEGORY) {
      return cat;
    }
  }

  let nextIndex = 2;
  if (existingOverflows.size > 0) {
    const last = existingOverflows.last();
    nextIndex = parseInt(last.name.match(overflowPattern)[1], 10) + 1;
  }

  const overwrites = baseCategory.permissionOverwrites?.cache
    ? baseCategory.permissionOverwrites.cache.map(ov => ({
        id: ov.id,
        type: ov.type,
        allow: ov.allow.bitfield,
        deny: ov.deny.bitfield
      }))
    : [];

  return guild.channels.create({
    name: `${baseCategory.name} (${nextIndex})`.slice(0, 100),
    type: ChannelType.GuildCategory,
    permissionOverwrites: overwrites,
    position: typeof baseCategory.rawPosition === 'number' ? baseCategory.rawPosition + 1 : undefined
  });
}

/**
 * Creates a text channel inside `candidateCategoryIds` (first valid one),
 * automatically creating/using an overflow category if the category has reached
 * Discord's 50-channel limit, and falling back to no parent if needed.
 */
async function createChannelWithOverflow(guild, candidateCategoryIds, channelOptions) {
  // Refresh channel cache so child counts are accurate
  await guild.channels.fetch().catch(() => null);

  let baseCategory = null;
  for (const id of candidateCategoryIds) {
    if (!id || !/^\d+$/.test(String(id))) continue;
    const cat = guild.channels.cache.get(String(id));
    if (cat && cat.type === ChannelType.GuildCategory) {
      baseCategory = cat;
      break;
    }
  }

  if (!baseCategory) {
    return guild.channels.create({ ...channelOptions });
  }

  // Pick base category if it has room, otherwise an overflow category
  let targetCategory = baseCategory;
  if (countChildren(guild, baseCategory.id) >= DISCORD_MAX_CHANNELS_PER_CATEGORY) {
    targetCategory = await getOrCreateOverflowCategory(guild, baseCategory).catch(() => null);
  }

  if (targetCategory) {
    try {
      return await guild.channels.create({ ...channelOptions, parent: targetCategory.id });
    } catch (err) {
      if (isCategoryFullError(err)) {
        const overflowCat = await getOrCreateOverflowCategory(guild, baseCategory).catch(() => null);
        if (overflowCat) {
          try {
            return await guild.channels.create({ ...channelOptions, parent: overflowCat.id });
          } catch (_) {
            // Fall through to creating without parent
          }
        }
      }
      console.warn('[CATEGORY] Channel creation in category failed, retrying without category:', err.message);
    }
  }

  const fallbackOptions = { ...channelOptions };
  delete fallbackOptions.parent;
  return guild.channels.create(fallbackOptions);
}

module.exports = {
  createChannelWithOverflow
};
