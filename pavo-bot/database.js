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
  oauth_states: {}
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
async function createTicket(ticketId, creatorId, creatorUsername, welcomeMessageId = null) {
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
    closed_at: null
  };
  save();
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

// Get active ticket for user
async function getUserOpenTicket(creatorId) {
  return Object.values(dbData.tickets).find(t => t.creator_id === creatorId && t.status === 'OPEN') || null;
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
  castLegitCheckVote
};
