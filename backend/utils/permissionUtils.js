/**
 * Permission constants and resolution logic
 */

export const PERMISSIONS = {
    VIEW_CHANNEL: 'viewChannel',
    SEND_MESSAGES: 'sendMessages',
    MANAGE_MESSAGES: 'manageMessages',
    MANAGE_CHANNELS: 'manageChannels',
    CREATE_CHANNELS: 'createChannels',
    MANAGE_ROLES: 'manageRoles',
    KICK_MEMBERS: 'kickMembers',
    BAN_MEMBERS: 'banMembers',
    CREATE_INVITE: 'createInvite',
    CONNECT: 'connect',
    SPEAK: 'speak'
};

/**
 * Resolves permissions for a user in a specific channel.
 * Hierarchy:
 * 1. Community-wide Base Role Permissions
 * 2. Category Overwrites (if synced)
 * 3. Channel Overwrites
 */
/**
 * Resolves permissions for a user in a specific channel.
 * Hierarchy:
 * 1. Community-wide Base Role Permissions (aggregated from all roles the user has)
 * 2. Category Overwrites (if channel.isSynced and category exists)
 * 3. Channel Overwrites
 */
export const resolveChannelPermissions = (user, community, channel) => {
    if (!user || !community) return {};
    
    // 1. Owner bypass
    if (community.owner.toString() === user._id.toString()) {
        return Object.values(PERMISSIONS).reduce((acc, p) => ({ ...acc, [p]: true }), {});
    }

    const membership = user.memberships?.find(m => m.communityId.toString() === community._id.toString());
    if (!membership) return {};

    // 2. Aggregate Community Role Permissions
    let basePerms = {};
    const userRoleIds = (membership.roles || []).map(r => r.toString());
    
    // Get all roles in community to check permissions
    const communityRoles = community.roles || [];
    
    // Start with default/everyone permissions? 
    // Usually the first role or the one named 'everyone'
    const everyoneRole = communityRoles.find(r => r.name === '@everyone');
    if (everyoneRole) {
        Object.assign(basePerms, everyoneRole.permissions || {});
    }

    // Add other user roles
    communityRoles.filter(r => userRoleIds.includes(r._id.toString())).forEach(role => {
        const perms = role.permissions || {};
        Object.keys(perms).forEach(k => {
            if (perms[k]) basePerms[k] = true;
        });
    });

    // 3. Resolve Overwrites
    let finalPerms = { ...basePerms };

    // Determine effective overwrites source
    let effectiveOverwrites = [];
    if (channel.isSynced && channel.categoryId) {
        const category = community.categories.find(c => c._id.toString() === channel.categoryId.toString());
        if (category) {
            effectiveOverwrites = category.permissionOverwrites || [];
        }
    } else {
        effectiveOverwrites = channel.permissionOverwrites || [];
    }

    // Apply Overwrites
    // A) @everyone (Lowest priority overwrite)
    const everyoneOverwrite = effectiveOverwrites.find(o => o.type === 'role' && everyoneRole && o.id.toString() === everyoneRole._id.toString());
    if (everyoneOverwrite) {
        everyoneOverwrite.deny.forEach(p => finalPerms[p] = false);
        everyoneOverwrite.allow.forEach(p => finalPerms[p] = true);
    }

    // B) Role Overwrites (Aggregated)
    const userRoleOverwrites = effectiveOverwrites.filter(o => o.type === 'role' && userRoleIds.includes(o.id.toString()));
    
    // First, aggregate all denies from all roles the user has
    userRoleOverwrites.forEach(overwrite => {
        overwrite.deny.forEach(p => finalPerms[p] = false);
    });
    // Then, aggregate all allows (Allow overrides Deny across roles at the same level)
    userRoleOverwrites.forEach(overwrite => {
        overwrite.allow.forEach(p => finalPerms[p] = true);
    });

    // C) Member Overwrite (Highest priority)
    const memberOverwrite = effectiveOverwrites.find(o => o.type === 'member' && o.id.toString() === user._id.toString());
    if (memberOverwrite) {
        memberOverwrite.deny.forEach(p => finalPerms[p] = false);
        memberOverwrite.allow.forEach(p => finalPerms[p] = true);
    }

    return finalPerms;
};
