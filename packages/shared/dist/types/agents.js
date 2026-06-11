"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STORY_ELEMENT_TYPES = exports.INTERVIEW_EVENT_KINDS = exports.INTERVENTION_LEVELS = exports.AGENT_REVIEW_STATUSES = exports.AGENT_RUN_STATUSES = exports.AGENT_TYPES = void 0;
exports.AGENT_TYPES = ['interview', 'editor_librarian'];
exports.AGENT_RUN_STATUSES = ['pending', 'running', 'completed', 'failed'];
exports.AGENT_REVIEW_STATUSES = ['unreviewed', 'approved', 'rejected', 'edited'];
exports.INTERVENTION_LEVELS = ['off', 'low', 'high'];
exports.INTERVIEW_EVENT_KINDS = [
    'opening',
    'warmup',
    'prior_story_recap',
    'gentle_probe',
    'transition',
    'emotional_support',
    'closing',
];
exports.STORY_ELEMENT_TYPES = [
    'time',
    'place',
    'person',
    'event',
    'theme',
    'emotion',
    'decision',
    'consequence',
    'reflection',
];
//# sourceMappingURL=agents.js.map