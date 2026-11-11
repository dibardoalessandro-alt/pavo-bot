const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'pavo_database.json');

// In-memory representation of our database schema
let dbData = {
  staff: {},
  tickets: {},
  sales: [],
  commission_percentages: {},
  giveaways: {},
  oauth_users: {},
  oauth_states: {},
  licenses: {},
  balances: {},
  transactions: [],
  gamestats: {},
  warnings: [],
  rule_acceptances: {},
  profiles: {},
  server_config: {},
  panels: {}
};

// Safe JSON write
function save() {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving data to database file:', err);
  }
}

// Database Initialization
async function initDatabase() {
  if (fs.existsSync(dbPath)) {
    try {
      const content = fs.readFileSync(dbPath, 'utf8');
      dbData = JSON.parse(content);
      // Ensure all fields exist
      if (!dbData.staff) dbData.staff = {};
      if (!dbData.tickets) dbData.tickets = {};
      if (!dbData.sales) dbData.sales = [];
      if (!dbData.commission_percentages) dbData.commission_percentages = {};
      if (!dbData.giveaways) dbData.giveaways = {};
      if (!dbData.oauth_users) dbData.oauth_users = {};
      if (!dbData.oauth_states) dbData.oauth_states = {};
      if (!dbData.licenses) dbData.licenses = {};
      if (!dbData.balances) dbData.balances = {};
      if (!dbData.transactions) dbData.transactions = [];
      if (!dbData.gamestats) dbData.gamestats = {};
      if (!dbData.warnings) dbData.warnings = [];
      if (!dbData.rule_acceptances) dbData.rule_acceptances = {};
      if (!dbData.profiles) dbData.profiles = {};
      if (!dbData.server_config) dbData.server_config = {};
      if (!dbData.panels) dbData.panels = {};
      console.log(`✅ Loaded existing database from: ${dbPath}`);
    } catch (err) {
      console.error('⚠️ Database file was corrupted or unreadable. Reinitializing...', err);
      save();
    }
  } else {
    console.log('🆕 Creating new JSON database file...');
    save();
  }
}

// ============================================
// Giveaway Persistence
// ============================================

async function createGiveaway(data) {
  const now = new Date().toISOString();
  dbData.giveaways[data.id] = {
    id: data.id,
    guildId: data.guildId,
    channelId: data.channelId,
    messageId: data.messageId || null,
    creatorId: data.creatorId,
    prize: data.prize,
    durationMs: data.durationMs,
    startedAt: now,
    endsAt: data.endsAt, // ISO string or timestamp
    maxParticipants: data.maxParticipants || 0, // 0 means unlimited
    winnerCount: data.winnerCount || 1,
    requireOAuth: Boolean(data.requireOAuth),
    participants: [],
    winners: [],
    status: 'ACTIVE' // 'ACTIVE', 'ENDED', 'CANCELLED'
  };
  save();
  return dbData.giveaways[data.id];
}

async function updateGiveawayMessage(id, messageId) {
  if (dbData.giveaways[id]) {
    dbData.giveaways[id].messageId = messageId;
    save();
  }
}

async function getGiveaway(id) {
  if (dbData.giveaways && dbData.giveaways[id]) {
    return dbData.giveaways[id];
  }
  if (fs.existsSync(dbPath)) {
    try {
      const content = fs.readFileSync(dbPath, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed.giveaways && parsed.giveaways[id]) {
        dbData.giveaways[id] = parsed.giveaways[id];
        return dbData.giveaways[id];
      }
    } catch (e) {}
  }
  return null;
}

async function getActiveGiveaways() {
  if (fs.existsSync(dbPath)) {
    try {
      const content = fs.readFileSync(dbPath, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed.giveaways) {
        dbData.giveaways = { ...parsed.giveaways, ...dbData.giveaways };
      }
    } catch (e) {}
  }
  return Object.values(dbData.giveaways).filter(g => g.status === 'ACTIVE');
}

async function getAllGiveaways() {
  return Object.values(dbData.giveaways);
}

async function addGiveawayParticipant(id, userId) {
  const giveaway = dbData.giveaways[id];
  if (!giveaway) return { success: false, reason: 'NOT_FOUND' };
  if (giveaway.status !== 'ACTIVE') return { success: false, reason: 'NOT_ACTIVE' };
  if (giveaway.participants.includes(userId)) return { success: false, reason: 'ALREADY_ENTERED' };
  if (giveaway.maxParticipants > 0 && giveaway.participants.length >= giveaway.maxParticipants) {
    return { success: false, reason: 'FULL' };
  }

  giveaway.participants.push(userId);
  save();
  return { success: true, count: giveaway.participants.length };
}

async function endGiveaway(id, winners = []) {
  const giveaway = dbData.giveaways[id];
  if (!giveaway) return null;
  giveaway.status = 'ENDED';
  giveaway.winners = winners;
  giveaway.endedAt = new Date().toISOString();
  save();
  return giveaway;
}

async function cancelGiveaway(id) {
  const giveaway = dbData.giveaways[id];
  if (!giveaway) return null;
  giveaway.status = 'CANCELLED';
  giveaway.endedAt = new Date().toISOString();
  save();
  return giveaway;
}

async function rerollGiveaway(id, newWinners = []) {
  const giveaway = dbData.giveaways[id];
  if (!giveaway) return null;
  giveaway.winners = newWinners;
  save();
  return giveaway;
}

// ============================================
// OAuth2 Persistence & Stats
// ============================================

async function saveOAuthUser(user) {
  const now = new Date().toISOString();
  const existing = dbData.oauth_users[user.discordId];
  
  dbData.oauth_users[user.discordId] = {
    discordId: user.discordId,
    username: user.username,
    discriminator: user.discriminator || '0',
    avatar: user.avatar || null,
    accessToken: user.accessToken || (existing ? existing.accessToken : null),
    refreshToken: user.refreshToken || (existing ? existing.refreshToken : null),
    expiresAt: user.expiresAt || null,
    authorizedAt: existing ? existing.authorizedAt : now,
    lastVerifiedAt: now,
    status: 'ACTIVE'
  };
  save();
  return dbData.oauth_users[user.discordId];
}

async function getOAuthUser(discordId) {
  return dbData.oauth_users[discordId] || null;
}

async function getAllOAuthUsers() {
  return Object.values(dbData.oauth_users).filter(u => u.status === 'ACTIVE' && u.accessToken);
}

async function revokeOAuthUser(discordId) {
  if (dbData.oauth_users[discordId]) {
    dbData.oauth_users[discordId].status = 'REVOKED';
    dbData.oauth_users[discordId].accessToken = null;
    dbData.oauth_users[discordId].refreshToken = null;
    save();
    return true;
  }
  return false;
}

async function getOAuthStats() {
  const users = Object.values(dbData.oauth_users).filter(u => u.status === 'ACTIVE');
  const total = users.length;
  
  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
  
  let today = 0;
  let thisWeek = 0;
  
  users.forEach(u => {
    const authTime = new Date(u.authorizedAt).getTime();
    if (authTime >= oneDayAgo) today++;
    if (authTime >= oneWeekAgo) thisWeek++;
  });

  return { total, today, thisWeek };
}

// OAuth State management (CSRF + giveaway tracking)
async function createOAuthState(state, userId = null, giveawayId = null) {
  dbData.oauth_states[state] = {
    state,
    userId,
    giveawayId,
    createdAt: Date.now()
  };
  
  // Clean up states older than 30 minutes
  const expiry = Date.now() - 30 * 60 * 1000;
  for (const s in dbData.oauth_states) {
    if (dbData.oauth_states[s].createdAt < expiry) {
      delete dbData.oauth_states[s];
    }
  }
  
  save();
  return dbData.oauth_states[state];
}

async function consumeOAuthState(state) {
  if (!state || !dbData.oauth_states[state]) return null;
  const data = { ...dbData.oauth_states[state] };
  delete dbData.oauth_states[state];
  save();
  return data;
}

// Ensure staff exists in DB
async function ensureStaffExists(discordId, username) {
  if (!dbData.staff[discordId]) {
    const joinDate = new Date().toISOString().split('T')[0];
    dbData.staff[discordId] = {
      discord_id: discordId,
      username: username,
      tickets_handled: 0,
      sales_count: 0,
      total_earnings: 0.0,
      join_date: joinDate
    };
    save();
  } else if (dbData.staff[discordId].username !== username) {
    dbData.staff[discordId].username = username;
    save();
  }
}

// Get Staff Info
async function getStaffInfo(discordId) {
  return dbData.staff[discordId] || null;
}

// Get Staff Statistics
async function getAllStaffStats() {
  return Object.values(dbData.staff).sort((a, b) => b.tickets_handled - a.tickets_handled);
}

// Record a new Ticket
// `meta` is optional: { kind: 'support' | 'purchase' | 'application', product, application }
async function createTicket(ticketId, creatorId, creatorUsername, welcomeMessageId = null, meta = {}) {
  const now = new Date().toISOString();
  dbData.tickets[ticketId] = {
    ticket_id: ticketId,
    creator_id: creatorId,
    creator_username: creatorUsername,
    welcome_message_id: welcomeMessageId,
    claimed_by: null,
    status: 'OPEN',
    closed_by: null,
    created_at: now,
    closed_at: null,
    kind: meta.kind || 'support',
    ...(meta.product ? { product: meta.product } : {}),
    ...(meta.application ? { application: meta.application } : {})
  };
  save();
  return dbData.tickets[ticketId];
}

// Claim a Ticket
async function claimTicket(ticketId, staffId, staffUsername) {
  await ensureStaffExists(staffId, staffUsername);
  if (dbData.tickets[ticketId]) {
    dbData.tickets[ticketId].claimed_by = staffId;
    save();
  }
}

// Close a Ticket
async function closeTicket(ticketId, staffId, staffUsername) {
  const now = new Date().toISOString();
  await ensureStaffExists(staffId, staffUsername);

  const wasAlreadyClosed = dbData.tickets[ticketId] && dbData.tickets[ticketId].status === 'CLOSED';

  if (dbData.tickets[ticketId]) {
    dbData.tickets[ticketId].status = 'CLOSED';
    dbData.tickets[ticketId].closed_by = staffId;
    dbData.tickets[ticketId].closed_at = now;
  } else {
    // If ticket was somehow not found in db, recreate basic entry to close
    dbData.tickets[ticketId] = {
      ticket_id: ticketId,
      creator_id: 'Unknown',
      creator_username: 'Unknown',
      welcome_message_id: null,
      claimed_by: null,
      status: 'CLOSED',
      closed_by: staffId,
      created_at: now,
      closed_at: now
    };
  }

  // Increment tickets_handled for the claimant only if not already closed
  if (!wasAlreadyClosed) {
    const ticket = dbData.tickets[ticketId];
    const handlerId = ticket.claimed_by ? ticket.claimed_by : staffId;
    
    if (!dbData.staff[handlerId]) {
      // If different, make sure the claimant also exists in staff DB
      const joinDate = new Date().toISOString().split('T')[0];
      dbData.staff[handlerId] = {
        discord_id: handlerId,
        username: 'Unknown Staff',
        tickets_handled: 0,
        sales_count: 0,
        total_earnings: 0.0,
        join_date: joinDate
      };
    }
    
    dbData.staff[handlerId].tickets_handled += 1;
  }

  save();
  
  return { ...dbData.tickets[ticketId], wasAlreadyClosed };
}

// Record verified sale
async function recordSale(customerId, customerUsername, staffId, staffUsername, product, price, paymentMethod, ticketId, commission) {
  await ensureStaffExists(staffId, staffUsername);
  const now = new Date().toISOString();

  // Insert sale record
  dbData.sales.push({
    sale_id: dbData.sales.length + 1,
    customer_id: customerId,
    customer_username: customerUsername,
    staff_id: staffId,
    product: product,
    price: price,
    payment_method: paymentMethod,
    date: now,
    ticket_id: ticketId,
    commission: commission
  });

  // Update staff stats
  dbData.staff[staffId].sales_count += 1;
  dbData.staff[staffId].total_earnings += commission;
  
  save();
}

// Get Commission Percentage for a specific role
async function getRoleCommissionPercentage(roleName, configDefaults) {
  if (dbData.commission_percentages[roleName] !== undefined) {
    return dbData.commission_percentages[roleName];
  }
  return configDefaults[roleName] !== undefined ? configDefaults[roleName] : 0.0;
}

// Set Commission Percentage for a specific role
async function setRoleCommissionPercentage(roleName, percentage) {
  dbData.commission_percentages[roleName] = percentage;
  save();
}

// Sales analytics
async function getSalesStats() {
  let count = 0;
  let revenue = 0.0;
  let commissions = 0.0;
  const methodsMap = {};

  dbData.sales.forEach(sale => {
    count++;
    revenue += sale.price;
    commissions += sale.commission;

    if (!methodsMap[sale.payment_method]) {
      methodsMap[sale.payment_method] = { count: 0, revenue: 0.0 };
    }
    methodsMap[sale.payment_method].count++;
    methodsMap[sale.payment_method].revenue += sale.price;
  });

  const byMethod = Object.entries(methodsMap).map(([method, data]) => ({
    payment_method: method,
    count: data.count,
    revenue: data.revenue
  }));

  return {
    count,
    revenue,
    commissions,
    byMethod
  };
}

// Sales by staff user
async function getSalesByUser(staffId) {
  let count = 0;
  let revenue = 0.0;
  let commission = 0.0;
  const userSales = [];

  dbData.sales.forEach(sale => {
    if (sale.staff_id === staffId) {
      count++;
      revenue += sale.price;
      commission += sale.commission;
      userSales.push(sale);
    }
  });

  // Sort by date descending and take top 10
  const recent = userSales
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);

  return {
    count,
    revenue,
    commission,
    recent
  };
}

// Sales leaderboard
async function getSalesLeaderboard() {
  const staffLeaderboard = {};

  dbData.sales.forEach(sale => {
    const sId = sale.staff_id;
    if (!staffLeaderboard[sId]) {
      staffLeaderboard[sId] = {
        staff_id: sId,
        username: dbData.staff[sId] ? dbData.staff[sId].username : 'Unknown',
        sales_count: 0,
        revenue: 0.0
      };
    }
    staffLeaderboard[sId].sales_count++;
    staffLeaderboard[sId].revenue += sale.price;
  });

  return Object.values(staffLeaderboard).sort((a, b) => {
    if (b.sales_count !== a.sales_count) {
      return b.sales_count - a.sales_count;
    }
    return b.revenue - a.revenue;
  });
}

// Get active support/purchase ticket for user (application tickets are tracked separately)
async function getUserOpenTicket(creatorId) {
  return Object.values(dbData.tickets).find(t => t.creator_id === creatorId && t.status === 'OPEN' && t.kind !== 'application') || null;
}

// Get active application ticket for a user and position type
async function getUserOpenApplication(creatorId, appType) {
  return Object.values(dbData.tickets).find(t =>
    t.creator_id === creatorId &&
    t.status === 'OPEN' &&
    t.kind === 'application' &&
    t.application && t.application.type === appType
  ) || null;
}

// Merge a patch into a ticket's application state (optionally also patch root ticket fields)
async function updateTicketApplication(ticketId, patch = {}, ticketPatch = {}) {
  const ticket = dbData.tickets[ticketId];
  if (!ticket) return null;
  Object.assign(ticket, ticketPatch);
  ticket.kind = 'application';
  ticket.application = { ...(ticket.application || {}), ...patch };
  save();
  return ticket;
}

// Persistent panel message tracking (application panel, etc.)
async function getPanelMessage(key) {
  if (!dbData.panels) dbData.panels = {};
  return dbData.panels[key] || null;
}

async function setPanelMessage(key, channelId, messageId) {
  if (!dbData.panels) dbData.panels = {};
  dbData.panels[key] = { channelId, messageId, updated_at: new Date().toISOString() };
  save();
}

// Get specific ticket
async function getTicket(ticketId) {
  return dbData.tickets[ticketId] || null;
}

// Reopen a ticket
async function reopenTicket(ticketId) {
  if (dbData.tickets[ticketId]) {
    dbData.tickets[ticketId].status = 'OPEN';
    dbData.tickets[ticketId].closed_by = null;
    dbData.tickets[ticketId].closed_at = null;
    save();
  }
}

// Delete ticket from database tracking
async function deleteTicket(ticketId) {
  if (dbData.tickets[ticketId]) {
    dbData.tickets[ticketId].status = 'DELETED';
    save();
  }
}

// ============================================
// Legit Check / Vouches Poll Persistence
// ============================================

async function getLegitCheckData() {
  if (!dbData.legit_check_poll) {
    dbData.legit_check_poll = {
      messageId: null,
      channelId: '1532484367090323467',
      votes: {} // { userId: 'yes' | 'no' }
    };
    save();
  }

  const votes = dbData.legit_check_poll.votes || {};
  let yesVotes = 0;
  let noVotes = 0;

  for (const v of Object.values(votes)) {
    if (v === 'yes') yesVotes++;
    if (v === 'no') noVotes++;
  }

  return {
    messageId: dbData.legit_check_poll.messageId,
    channelId: dbData.legit_check_poll.channelId,
    votes,
    yesVotes,
    noVotes
  };
}

async function setLegitCheckMessage(channelId, messageId) {
  if (!dbData.legit_check_poll) {
    dbData.legit_check_poll = { messageId: null, channelId, votes: {} };
  }
  dbData.legit_check_poll.channelId = channelId;
  dbData.legit_check_poll.messageId = messageId;
  save();
}

async function castLegitCheckVote(userId, voteType) {
  if (!dbData.legit_check_poll) {
    dbData.legit_check_poll = { messageId: null, channelId: '1532484367090323467', votes: {} };
  }
  if (!dbData.legit_check_poll.votes) {
    dbData.legit_check_poll.votes = {};
  }

  const currentVote = dbData.legit_check_poll.votes[userId];
  const alreadyVotedThis = currentVote === voteType;

  dbData.legit_check_poll.votes[userId] = voteType;
  save();

  let yesVotes = 0;
  let noVotes = 0;
  for (const v of Object.values(dbData.legit_check_poll.votes)) {
    if (v === 'yes') yesVotes++;
    if (v === 'no') noVotes++;
  }

  return {
    alreadyVotedThis,
    voteType,
    yesVotes,
    noVotes
  };
}

// ============================================
// KEY / LICENSE SYSTEM PERSISTENCE
// ============================================

function generateKeyString(prefix = 'PAVO') {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const block = () => Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  return `${prefix}-${block()}-${block()}-${block()}`;
}

async function createKey(data) {
  const now = new Date();
  const keyStr = data.key || generateKeyString(data.prefix || 'PAVO');

  let expiresAt = null;
  let durationDays = null;

  if (data.duration === 'lifetime') {
    expiresAt = null;
    durationDays = null;
  } else if (data.duration === '30d') {
    durationDays = 30;
    expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  } else if (data.duration === '7d') {
    durationDays = 7;
    expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  } else if (data.durationDays) {
    durationDays = Number(data.durationDays);
    expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  }

  const licenseRecord = {
    key: keyStr,
    product: data.product || 'BlockSpin',
    duration: data.duration || 'lifetime',
    durationDays: durationDays,
    createdAt: now.toISOString(),
    expiresAt: expiresAt,
    createdBy: data.createdBy || 'System',
    creatorTag: data.creatorTag || 'Staff',
    redeemedBy: null,
    redeemerTag: null,
    redeemedAt: null,
    revokedBy: null,
    revocationReason: null,
    status: 'ACTIVE', // ACTIVE, REDEEMED, EXPIRED, REVOKED
    notes: data.notes || ''
  };

  dbData.licenses[keyStr] = licenseRecord;
  save();
  return licenseRecord;
}

async function createMultipleKeys(product, duration, quantity, createdBy, creatorTag, notes) {
  const keys = [];
  for (let i = 0; i < quantity; i++) {
    const key = await createKey({ product, duration, createdBy, creatorTag, notes });
    keys.push(key);
  }
  return keys;
}

async function getKey(key) {
  if (!key) return null;
  const k = key.trim().toUpperCase();
  const record = dbData.licenses[k];
  if (!record) return null;

  // Check if active key has expired
  if (record.status === 'ACTIVE' && record.expiresAt) {
    if (new Date(record.expiresAt) < new Date()) {
      record.status = 'EXPIRED';
      save();
    }
  }

  return record;
}

async function getAllKeys(filter = {}) {
  let list = Object.values(dbData.licenses || {});
  
  if (filter.status) {
    list = list.filter(k => k.status.toUpperCase() === filter.status.toUpperCase());
  }
  if (filter.product) {
    list = list.filter(k => k.product.toLowerCase().includes(filter.product.toLowerCase()));
  }
  if (filter.userId) {
    list = list.filter(k => k.redeemedBy === filter.userId || k.createdBy === filter.userId);
  }

  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function redeemKey(keyStr, userId, userTag) {
  const record = await getKey(keyStr);
  if (!record) return { success: false, reason: 'NOT_FOUND' };
  if (record.status === 'REVOKED') return { success: false, reason: 'REVOKED' };
  if (record.status === 'REDEEMED') return { success: false, reason: 'ALREADY_REDEEMED', redeemedBy: record.redeemedBy, redeemedAt: record.redeemedAt };
  if (record.status === 'EXPIRED') return { success: false, reason: 'EXPIRED' };

  // Update status
  const now = new Date();
  record.status = 'REDEEMED';
  record.redeemedBy = userId;
  record.redeemerTag = userTag;
  record.redeemedAt = now.toISOString();

  // If duration is timed from redemption date
  if (record.durationDays && !record.expiresAt) {
    record.expiresAt = new Date(now.getTime() + record.durationDays * 24 * 60 * 60 * 1000).toISOString();
  }

  save();
  return { success: true, license: record };
}

async function revokeKey(keyStr, revokedBy, reason = 'Revoked by Staff') {
  const record = await getKey(keyStr);
  if (!record) return { success: false, reason: 'NOT_FOUND' };

  record.status = 'REVOKED';
  record.revokedBy = revokedBy;
  record.revocationReason = reason;
  record.revokedAt = new Date().toISOString();
  save();
  return { success: true, license: record };
}

async function deleteKey(keyStr) {
  const k = keyStr.trim().toUpperCase();
  if (dbData.licenses[k]) {
    delete dbData.licenses[k];
    save();
    return true;
  }
  return false;
}

// ============================================
// VIRTUAL CURRENCY (PAVO COINS) & ECONOMY
// ============================================

async function getBalance(userId) {
  if (!dbData.balances[userId]) {
    dbData.balances[userId] = {
      userId,
      coins: 500, // Starting balance
      bank: 0,
      lastDaily: null,
      createdAt: new Date().toISOString()
    };
    save();
  }
  return dbData.balances[userId];
}

async function addBalance(userId, amount, reason = 'Reward', txType = 'EARN') {
  const userBal = await getBalance(userId);
  const qty = Math.max(0, Math.floor(Number(amount) || 0));
  userBal.coins += qty;
  userBal.updatedAt = new Date().toISOString();

  // Record transaction
  dbData.transactions.push({
    id: `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userId,
    type: txType,
    amount: qty,
    balanceAfter: userBal.coins,
    reason,
    timestamp: new Date().toISOString()
  });

  save();
  return userBal.coins;
}

async function removeBalance(userId, amount, reason = 'Bet/Payment', txType = 'SPEND') {
  const userBal = await getBalance(userId);
  const qty = Math.max(0, Math.floor(Number(amount) || 0));
  
  if (userBal.coins < qty) {
    return { success: false, currentBalance: userBal.coins, required: qty };
  }

  userBal.coins -= qty;
  userBal.updatedAt = new Date().toISOString();

  dbData.transactions.push({
    id: `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userId,
    type: txType,
    amount: -qty,
    balanceAfter: userBal.coins,
    reason,
    timestamp: new Date().toISOString()
  });

  save();
  return { success: true, newBalance: userBal.coins };
}

async function transferCoins(fromUserId, toUserId, amount, reason = 'User Transfer') {
  const qty = Math.max(1, Math.floor(Number(amount) || 0));
  const senderBal = await getBalance(fromUserId);

  if (senderBal.coins < qty) {
    return { success: false, reason: 'INSUFFICIENT_FUNDS', currentBalance: senderBal.coins };
  }

  const senderRemove = await removeBalance(fromUserId, qty, `Transfer to ${toUserId}: ${reason}`, 'TRANSFER_OUT');
  if (!senderRemove.success) return senderRemove;

  const receiverCoins = await addBalance(toUserId, qty, `Transfer from ${fromUserId}: ${reason}`, 'TRANSFER_IN');

  return {
    success: true,
    amount: qty,
    senderNewBalance: senderRemove.newBalance,
    receiverNewBalance: receiverCoins
  };
}

async function claimDaily(userId, rewardAmount = 500) {
  const userBal = await getBalance(userId);
  const now = Date.now();
  const cooldownMs = 24 * 60 * 60 * 1000;

  if (userBal.lastDaily) {
    const lastClaim = new Date(userBal.lastDaily).getTime();
    if (now - lastClaim < cooldownMs) {
      const remainingMs = cooldownMs - (now - lastClaim);
      return { success: false, cooldownRemainingMs: remainingMs };
    }
  }

  userBal.coins += rewardAmount;
  userBal.lastDaily = new Date(now).toISOString();
  userBal.updatedAt = new Date(now).toISOString();

  dbData.transactions.push({
    id: `TX-DAILY-${now}`,
    userId,
    type: 'DAILY_REWARD',
    amount: rewardAmount,
    balanceAfter: userBal.coins,
    reason: 'Daily Coins Claim',
    timestamp: new Date(now).toISOString()
  });

  save();
  return { success: true, reward: rewardAmount, newBalance: userBal.coins };
}

async function getEconomyLeaderboard(limit = 10) {
  const users = Object.values(dbData.balances || {});
  return users
    .sort((a, b) => b.coins - a.coins)
    .slice(0, limit);
}

// ============================================
// GAMBLING STATISTICS & RECORDING
// ============================================

async function getGameStats(userId) {
  if (!dbData.gamestats[userId]) {
    dbData.gamestats[userId] = {
      userId,
      totalGames: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      coinsWon: 0,
      coinsLost: 0,
      guessWins: 0,
      diceWins: 0,
      slotsWins: 0,
      coinflipWins: 0,
      blackjackWins: 0,
      highlowWins: 0,
      lastPlayed: null
    };
    save();
  }
  return dbData.gamestats[userId];
}

async function recordGameResult(data) {
  const { userId, gameType, outcome, betAmount = 0, payout = 0, opponentId = null } = data;
  const stats = await getGameStats(userId);

  stats.totalGames += 1;
  stats.lastPlayed = new Date().toISOString();

  if (outcome === 'WIN') {
    stats.wins += 1;
    const profit = Math.max(0, payout - betAmount);
    stats.coinsWon += profit;

    if (gameType === 'guess') stats.guessWins += 1;
    if (gameType === 'dice') stats.diceWins += 1;
    if (gameType === 'slots') stats.slotsWins += 1;
    if (gameType === 'coinflip') stats.coinflipWins += 1;
    if (gameType === 'blackjack') stats.blackjackWins += 1;
    if (gameType === 'highlow') stats.highlowWins += 1;
  } else if (outcome === 'LOSS') {
    stats.losses += 1;
    stats.coinsLost += betAmount;
  } else if (outcome === 'DRAW' || outcome === 'TIE') {
    stats.draws += 1;
  }

  save();
  return stats;
}

async function getGamesLeaderboard(type = 'wins', limit = 10) {
  const allStats = Object.values(dbData.gamestats || {});
  if (type === 'coins') {
    return allStats.sort((a, b) => (b.coinsWon - b.coinsLost) - (a.coinsWon - a.coinsLost)).slice(0, limit);
  } else if (type === 'games') {
    return allStats.sort((a, b) => b.totalGames - a.totalGames).slice(0, limit);
  } else {
    return allStats.sort((a, b) => b.wins - a.wins).slice(0, limit);
  }
}

// ============================================
// WARNINGS & MODERATION PERSISTENCE
// ============================================

async function addWarning(userId, moderatorId, reason = 'No reason provided') {
  const warning = {
    id: `WARN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userId,
    moderatorId,
    reason,
    timestamp: new Date().toISOString()
  };

  dbData.warnings.push(warning);
  save();
  return warning;
}

async function getWarnings(userId) {
  return (dbData.warnings || []).filter(w => w.userId === userId);
}

async function clearWarnings(userId) {
  const countBefore = (dbData.warnings || []).length;
  dbData.warnings = (dbData.warnings || []).filter(w => w.userId !== userId);
  save();
  return countBefore - dbData.warnings.length;
}

// ============================================
// RULE ACCEPTANCE & PROFILE PROGRESSION
// ============================================

async function recordRuleAcceptance(userId, userTag) {
  if (dbData.rule_acceptances[userId]) {
    return { alreadyAccepted: true, acceptedAt: dbData.rule_acceptances[userId].acceptedAt };
  }

  dbData.rule_acceptances[userId] = {
    userId,
    userTag,
    acceptedAt: new Date().toISOString()
  };
  save();
  return { alreadyAccepted: false, acceptedAt: dbData.rule_acceptances[userId].acceptedAt };
}

async function hasAcceptedRules(userId) {
  return Boolean(dbData.rule_acceptances && dbData.rule_acceptances[userId]);
}

async function addXp(userId, amount = 10) {
  if (!dbData.profiles[userId]) {
    dbData.profiles[userId] = {
      userId,
      xp: 0,
      level: 1,
      lastActive: new Date().toISOString()
    };
  }

  const p = dbData.profiles[userId];
  p.xp += amount;
  
  // Calculate level: Level = floor(sqrt(xp / 100)) + 1
  const newLevel = Math.floor(Math.sqrt(p.xp / 100)) + 1;
  const leveledUp = newLevel > p.level;
  p.level = newLevel;
  p.lastActive = new Date().toISOString();

  save();
  return { xp: p.xp, level: p.level, leveledUp };
}

async function getUserProfile(userId) {
  const bal = await getBalance(userId);
  const stats = await getGameStats(userId);
  const warnings = await getWarnings(userId);
  const accepted = await hasAcceptedRules(userId);

  if (!dbData.profiles[userId]) {
    dbData.profiles[userId] = {
      userId,
      xp: 50,
      level: 1,
      lastActive: new Date().toISOString()
    };
    save();
  }

  return {
    userId,
    balance: bal.coins,
    stats,
    warningsCount: warnings.length,
    rulesAccepted: accepted,
    profile: dbData.profiles[userId]
  };
}

module.exports = {
  initDatabase,
  ensureStaffExists,
  getStaffInfo,
  getAllStaffStats,
  createTicket,
  claimTicket,
  closeTicket,
  recordSale,
  getRoleCommissionPercentage,
  setRoleCommissionPercentage,
  getSalesStats,
  getSalesByUser,
  getSalesLeaderboard,
  getUserOpenTicket,
  getUserOpenApplication,
  updateTicketApplication,
  getPanelMessage,
  setPanelMessage,
  getTicket,
  reopenTicket,
  deleteTicket,
  createGiveaway,
  updateGiveawayMessage,
  getGiveaway,
  getActiveGiveaways,
  getAllGiveaways,
  addGiveawayParticipant,
  endGiveaway,
  cancelGiveaway,
  rerollGiveaway,
  saveOAuthUser,
  getOAuthUser,
  getAllOAuthUsers,
  revokeOAuthUser,
  getOAuthStats,
  createOAuthState,
  consumeOAuthState,
  getLegitCheckData,
  setLegitCheckMessage,
  castLegitCheckVote,
  // Key / License system
  createKey,
  createMultipleKeys,
  getKey,
  getAllKeys,
  redeemKey,
  revokeKey,
  deleteKey,
  // Virtual Currency / Economy
  getBalance,
  addBalance,
  removeBalance,
  transferCoins,
  claimDaily,
  getEconomyLeaderboard,
  // Gambling stats
  getGameStats,
  recordGameResult,
  getGamesLeaderboard,
  // Moderation
  addWarning,
  getWarnings,
  clearWarnings,
  // Rules & Profiles
  recordRuleAcceptance,
  hasAcceptedRules,
  addXp,
  getUserProfile
};
