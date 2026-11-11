/**
 * Pavo Team Applications — position definitions.
 *
 * Edit requirements, questions and wording here. Channel/role IDs live in config.json
 * under "applications" (panelChannelId, categoryId, logChannelId, reviewerRoles).
 *
 * Discord limits to keep in mind when editing:
 *  - Question `label`        → max 45 characters
 *  - Question `placeholder`  → max 100 characters
 *  - A modal holds max 5 questions, so questions are split into pages of 5 automatically.
 *  - `key` must be unique per position and must not change once applications are live.
 */

const SHORT = 'short';
const PARAGRAPH = 'paragraph';

const positions = {
  content_creator: {
    key: 'content_creator',
    name: 'Content Creator',
    emoji: '🎥',
    channelPrefix: 'content-creator',
    panelSummary: 'Create high-quality content around Pavo, Pavo Hub and Blockspin.',
    intro:
      'Content Creators represent Pavo across social media. You will showcase Pavo, Pavo Hub and Blockspin ' +
      'to your audience and help grow the community with consistent, high-quality content.',
    requirements: [
      'Discord account must be in the Pavo community',
      'At least **200–500+ followers**, depending on platform and content quality',
      'Consistent views and engagement on your content',
      'Able to create content related to **Pavo / Pavo Hub / Blockspin**',
      'High-quality content — no spam or low-effort uploads',
      'Active on both your platform and in the community',
      'Good reputation within the community'
    ],
    questions: [
      { key: 'discord_username', label: 'Discord Username', style: SHORT, prefillUsername: true, maxLength: 100 },
      { key: 'platform', label: 'Main Social Media Platform', style: SHORT, placeholder: 'TikTok, YouTube, Instagram, Twitch...', maxLength: 100 },
      { key: 'profile_link', label: 'Social Media Profile / Link', style: SHORT, placeholder: 'https://...', maxLength: 200 },
      { key: 'followers', label: 'Current Follower Count', style: SHORT, placeholder: 'e.g. 1,250', maxLength: 50 },
      { key: 'avg_views', label: 'Average Views per Post / Video', style: SHORT, placeholder: 'e.g. 3,000', maxLength: 50 },
      { key: 'examples', label: 'Examples of Previous Content', style: PARAGRAPH, placeholder: 'Links to some of your best videos or posts.', maxLength: 700 },
      { key: 'motivation', label: 'Why become a Pavo Content Creator?', style: PARAGRAPH, placeholder: 'Tell us what you would bring to Pavo.', maxLength: 700 }
    ]
  },

  beta_tester: {
    key: 'beta_tester',
    name: 'Beta Tester',
    emoji: '🧪',
    channelPrefix: 'beta-tester',
    panelSummary: 'Test new products, updates and features before public release.',
    intro:
      'Beta Testers help test new Pavo products, updates and features before they are released to the public. ' +
      'Your feedback and bug reports directly shape the quality of every release.',
    requirements: [
      'Active in the Pavo Discord',
      'Trustworthy and reliable',
      'Pavo Discord/community tag, or an established part of the community',
      'Willing to report bugs properly and in detail',
      '**Never** leak private or beta builds',
      'Able to communicate clearly with staff',
      'Compatible executor/environment for testing Blockspin-related builds'
    ],
    questions: [
      { key: 'discord_username', label: 'Discord Username', style: SHORT, prefillUsername: true, maxLength: 100 },
      { key: 'executor', label: 'Executor / Environment You Use', style: SHORT, placeholder: 'Name and version of your executor/environment', maxLength: 150 },
      { key: 'device', label: 'Device / PC You Use', style: SHORT, placeholder: 'e.g. Windows 11, Ryzen 5 5600, RTX 3060', maxLength: 150 },
      { key: 'activity', label: 'How Active Are You?', style: SHORT, placeholder: 'e.g. Daily, 3–4 hours', maxLength: 150 },
      { key: 'experience', label: 'Previous Beta-Testing Experience', style: PARAGRAPH, placeholder: 'Projects you have tested before, if any.', maxLength: 700 },
      { key: 'why_you', label: 'Why Should We Choose You?', style: PARAGRAPH, maxLength: 700 },
      { key: 'bug_reports', label: 'Willing to Report Bugs Properly?', style: SHORT, placeholder: 'Yes / No', maxLength: 150 },
      { key: 'confidentiality', label: 'Willing to Keep Beta Info Private?', style: SHORT, placeholder: 'Yes / No', maxLength: 150 }
    ]
  },

  staff: {
    key: 'staff',
    name: 'Staff',
    emoji: '🛡️',
    channelPrefix: 'staff',
    panelSummary: 'Support customers and help keep the community running smoothly.',
    intro:
      'Staff members support customers, moderate the community and work closely with the existing team ' +
      'to keep Pavo running at a professional standard.',
    requirements: [
      'Active in the Pavo community',
      'Mature and respectful',
      'Good communication skills',
      'Understands the Pavo community and products',
      'No serious moderation history',
      'Able to help customers with their questions',
      'Able to work with the existing staff team',
      'Pavo Discord/community tag, or an active member of the community'
    ],
    questions: [
      { key: 'discord_username', label: 'Discord Username', style: SHORT, prefillUsername: true, maxLength: 100 },
      { key: 'age', label: 'Age', style: SHORT, maxLength: 3 },
      { key: 'timezone', label: 'Timezone', style: SHORT, placeholder: 'e.g. CET (UTC+1)', maxLength: 50 },
      { key: 'experience', label: 'Previous Staff Experience', style: PARAGRAPH, placeholder: 'Servers, roles and responsibilities.', maxLength: 700 },
      { key: 'time_in_pavo', label: 'How Long Have You Been in Pavo?', style: SHORT, maxLength: 100 },
      { key: 'motivation', label: 'Why Do You Want to Become Staff?', style: PARAGRAPH, maxLength: 700 },
      { key: 'hours', label: 'Hours Active per Week', style: SHORT, placeholder: 'e.g. 15–20 hours', maxLength: 100 },
      { key: 'rule_scenario', label: 'A Customer Breaks the Rules — What Now?', style: PARAGRAPH, placeholder: 'Describe the steps you would take.', maxLength: 700 },
      { key: 'why_you', label: 'Why Should We Choose You?', style: PARAGRAPH, maxLength: 700 },
      { key: 'extra', label: 'Anything Else We Should Know?', style: PARAGRAPH, required: false, maxLength: 500 }
    ]
  }
};

module.exports = { positions, SHORT, PARAGRAPH };

