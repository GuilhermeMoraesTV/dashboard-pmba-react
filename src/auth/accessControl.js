export const LEGACY_ADMIN_UID = 'OLoJi457GQNE2eTSOcz9DAD6ppZ2';

export const ADMIN_ROLE_VALUES = ['admin', 'super_admin'];

export const DEFAULT_ACCESS_PROFILE = {
  version: 1,
  migrationPhase: 'legacy_uid_compatible',
  role: 'student',
  adminRole: null,
  permissions: {
    adminPanel: false,
    manageBroadcasts: false,
    manageTemplates: false,
    viewAdminAnalytics: false,
  },
};

const normalizePermissions = (permissions = {}) => ({
  ...DEFAULT_ACCESS_PROFILE.permissions,
  ...(permissions && typeof permissions === 'object' ? permissions : {}),
});

export const normalizeAccessProfile = (access = {}) => ({
  ...DEFAULT_ACCESS_PROFILE,
  ...(access && typeof access === 'object' ? access : {}),
  permissions: normalizePermissions(access?.permissions),
});

export const buildInitialAccessProfile = ({ isLegacyAdmin = false } = {}) => {
  if (!isLegacyAdmin) return DEFAULT_ACCESS_PROFILE;

  return {
    ...DEFAULT_ACCESS_PROFILE,
    role: 'admin',
    adminRole: 'super_admin',
    permissions: {
      adminPanel: true,
      manageBroadcasts: true,
      manageTemplates: true,
      viewAdminAnalytics: true,
    },
  };
};

export const deriveUserAccess = ({ authUser = null, userDoc = null } = {}) => {
  const accessProfile = normalizeAccessProfile(userDoc?.access);
  const isLegacyAdmin = authUser?.uid === LEGACY_ADMIN_UID;
  const hasAdminRole = ADMIN_ROLE_VALUES.includes(accessProfile.adminRole)
    || accessProfile.role === 'admin'
    || accessProfile.permissions.adminPanel === true;

  const isAdmin = isLegacyAdmin || hasAdminRole;

  return {
    isLoading: false,
    isLegacyAdmin,
    isAdmin,
    role: accessProfile.role,
    adminRole: accessProfile.adminRole,
    permissions: {
      ...accessProfile.permissions,
      adminPanel: isAdmin || accessProfile.permissions.adminPanel === true,
      manageBroadcasts: isAdmin || accessProfile.permissions.manageBroadcasts === true,
      manageTemplates: isAdmin || accessProfile.permissions.manageTemplates === true,
      viewAdminAnalytics: isAdmin || accessProfile.permissions.viewAdminAnalytics === true,
    },
    accessProfile,
    userDoc,
  };
};
