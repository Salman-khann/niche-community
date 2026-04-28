import AuditLog from '../models/auditLog.model.js';

/**
 * Creates an audit log entry.
 * @param {string} communityId - ID of the community
 * @param {string} moderatorId - ID of the user performing the action
 * @param {string|null} targetUserId - ID of the user affected by the action (if any)
 * @param {string} actionType - Type of action (from enum)
 * @param {string} reason - Reason for the action
 * @param {object} metadata - Additional context
 */
export const logAction = async (communityId, moderatorId, targetUserId, actionType, reason = '', metadata = {}) => {
    try {
        await AuditLog.create({
            communityId,
            moderatorId,
            targetUserId: targetUserId || null,
            actionType,
            reason,
            metadata
        });
    } catch (error) {
        console.error('Failed to create audit log:', error);
        // We don't want to fail the main request if logging fails, but we should know about it.
    }
};
