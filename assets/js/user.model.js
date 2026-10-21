
/* =========================================================
   MedOrbits -- assets/js/user.model.js
   User model, normalization, profile utilities, and validation
   Version: 1.1.0
   ========================================================= */

(function (window) {
  "use strict";

  const MODEL_VERSION = "1.1.0";

  const USER_ROLES = Object.freeze({
    STUDENT: "student",
    COUNSELLOR: "counsellor",
    COLLEGE: "college",
    EMPLOYER: "employer",
    RECRUITER: "recruiter",
    ADMIN: "admin",
    SUPER_ADMIN: "super_admin"
  });

  const ACCOUNT_STATUSES = Object.freeze({
    ACTIVE: "active",
    PENDING: "pending",
    SUSPENDED: "suspended",
    DISABLED: "disabled",
    DELETED: "deleted"
  });

  const VERIFICATION_STATUSES = Object.freeze({
    UNVERIFIED: "unverified",
    PENDING: "pending",
    VERIFIED: "verified",
    REJECTED: "rejected"
  });

  const PROFILE_FIELDS = Object.freeze([
    "firstName",
    "lastName",
    "email",
    "phone",
    "dateOfBirth",
    "gender",
    "profileImage",
    "bio",
    "address",
    "city",
    "state",
    "country",
    "postalCode",
    "education",
    "interests",
    "skills",
    "languages",
    "website",
    "linkedin"
  ]);

  const VALID_ROLES = Object.freeze(Object.values(USER_ROLES));
  const VALID_STATUSES = Object.freeze(Object.values(ACCOUNT_STATUSES));
  const VALID_VERIFICATION_STATUSES = Object.freeze(
    Object.values(VERIFICATION_STATUSES)
  );

  const ROLE_ALIASES = Object.freeze({
    user: USER_ROLES.STUDENT,
    applicant: USER_ROLES.STUDENT,
    student: USER_ROLES.STUDENT,
    superadmin: USER_ROLES.SUPER_ADMIN,
    super_admin: USER_ROLES.SUPER_ADMIN,
    counselor: USER_ROLES.COUNSELLOR,
    counsellor: USER_ROLES.COUNSELLOR
  });

  function isObject(value) {
    return value !== null &&
      typeof value === "object" &&
      !Array.isArray(value);
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function cleanString(value, maxLength = 500) {
    if (value === undefined || value === null) return "";
    if (typeof value === "object" || typeof value === "function") return "";

    return String(value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .trim()
      .slice(0, maxLength);
  }

  function firstDefined() {
    for (let index = 0; index < arguments.length; index += 1) {
      const value = arguments[index];

      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }

    return undefined;
  }

  function normalizeEmail(value) {
    return cleanString(value, 254).toLowerCase();
  }

  function normalizePhone(value) {
    let phone = cleanString(value, 30);

    phone = phone.replace(/[^\d+()\-\s]/g, "");

    // Keep a leading plus sign only.
    const plusIndex = phone.indexOf("+");

    if (plusIndex > 0) {
      phone = phone.replace(/\+/g, "");
    } else if (plusIndex === 0) {
      phone = "+" + phone.slice(1).replace(/\+/g, "");
    }

    return phone.trim();
  }

  function normalizeRole(value) {
    const role = cleanString(value, 50)
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

    const normalized = ROLE_ALIASES[role] || role;

    return VALID_ROLES.includes(normalized)
      ? normalized
      : USER_ROLES.STUDENT;
  }

  function isValidRole(value) {
    const role = cleanString(value, 50)
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

    return VALID_ROLES.includes(ROLE_ALIASES[role] || role);
  }

  function normalizeStatus(value) {
    const status = cleanString(value, 30).toLowerCase();

    return VALID_STATUSES.includes(status)
      ? status
      : ACCOUNT_STATUSES.PENDING;
  }

  function normalizeVerification(value) {
    const status = cleanString(value, 30).toLowerCase();

    return VALID_VERIFICATION_STATUSES.includes(status)
      ? status
      : VERIFICATION_STATUSES.UNVERIFIED;
  }

  function normalizeArray(value, maxItems = 100, maxItemLength = 200) {
    if (!Array.isArray(value)) return [];

    const result = [];
    const seen = new Set();

    value.slice(0, Math.max(maxItems * 3, maxItems)).forEach(function (item) {
      if (
        item === null ||
        item === undefined ||
        typeof item === "object" ||
        typeof item === "function"
      ) {
        return;
      }

      const normalized = cleanString(item, maxItemLength);

      if (!normalized) return;

      const key = normalized.toLowerCase();

      if (seen.has(key)) return;

      seen.add(key);
      result.push(normalized);
    });

    return result.slice(0, maxItems);
  }

  function normalizeAddress(value) {
    if (typeof value === "string") {
      return {
        line1: cleanString(value, 200),
        line2: "",
        city: "",
        state: "",
        country: "",
        postalCode: ""
      };
    }

    const address = isObject(value) ? value : {};

    return {
      line1: cleanString(
        firstDefined(address.line1, address.addressLine1),
        200
      ),
      line2: cleanString(
        firstDefined(address.line2, address.addressLine2),
        200
      ),
      city: cleanString(address.city, 100),
      state: cleanString(
        firstDefined(address.state, address.province),
        100
      ),
      country: cleanString(address.country, 100),
      postalCode: cleanString(
        firstDefined(address.postalCode, address.zipCode, address.pincode),
        20
      )
    };
  }

  function normalizeYear(value) {
    if (
      value === "" ||
      value === null ||
      value === undefined
    ) {
      return null;
    }

    const year = Number(value);

    if (
      !Number.isInteger(year) ||
      year < 1900 ||
      year > new Date().getFullYear() + 10
    ) {
      return null;
    }

    return year;
  }

  function normalizeEducation(value) {
    if (!Array.isArray(value)) return [];

    return value.slice(0, 50).filter(isObject).map(function (item) {
      const startYear = normalizeYear(item.startYear);
      const endYear = normalizeYear(item.endYear);

      return {
        qualification: cleanString(
          firstDefined(item.qualification, item.degree, item.level),
          150
        ),
        institution: cleanString(
          firstDefined(item.institution, item.college, item.school),
          200
        ),
        fieldOfStudy: cleanString(
          firstDefined(
            item.fieldOfStudy,
            item.stream,
            item.specialization
          ),
          150
        ),
        startYear: startYear,
        endYear: endYear,
        grade: cleanString(
          firstDefined(item.grade, item.result),
          50
        ),
        currentlyStudying: item.currentlyStudying === true
      };
    });
  }

  function normalizePreferences(value) {
    const preferences = isObject(value) ? value : {};
    const theme = cleanString(preferences.theme, 20).toLowerCase();

    return {
      language: cleanString(preferences.language || "en", 20),
      timezone: cleanString(preferences.timezone, 100),
      theme: ["light", "dark", "system"].includes(theme)
        ? theme
        : "system",
      emailNotifications: preferences.emailNotifications !== false,
      smsNotifications: preferences.smsNotifications === true,
      pushNotifications: preferences.pushNotifications !== false,
      marketingEmails: preferences.marketingEmails === true
    };
  }

  function normalizeVerificationData(value) {
    const verification = isObject(value) ? value : {};

    return {
      email: normalizeVerification(verification.email),
      phone: normalizeVerification(verification.phone),
      identity: normalizeVerification(verification.identity),
      updatedAt: cleanString(verification.updatedAt, 50) || null
    };
  }

  function normalizeSubscription(value) {
    const subscription = isObject(value) ? value : {};

    const allowedStatuses = [
      "inactive",
      "active",
      "trialing",
      "pending",
      "past_due",
      "cancelled",
      "canceled",
      "expired",
      "suspended"
    ];

    const rawStatus = cleanString(
      subscription.status || "inactive",
      30
    ).toLowerCase();

    return {
      id: cleanString(
        firstDefined(subscription.id, subscription.subscriptionId),
        150
      ),
      plan: cleanString(
        firstDefined(subscription.plan, subscription.planName),
        100
      ),
      status: allowedStatuses.includes(rawStatus)
        ? rawStatus
        : "inactive",
      startsAt: cleanString(subscription.startsAt, 50) || null,
      expiresAt: cleanString(subscription.expiresAt, 50) || null,
      autoRenew: subscription.autoRenew === true
    };
  }

  function normalizeMetadata(value) {
    if (!isObject(value)) return {};

    const allowedKeys = [
      "source",
      "campaign",
      "referralCode",
      "onboardingCompleted",
      "profileCompletion"
    ];

    const metadata = {};

    allowedKeys.forEach(function (key) {
      if (!hasOwn(value, key)) return;

      const item = value[key];

      if (item === null || ["string", "number", "boolean"].includes(typeof item)) {
        if (typeof item === "string") {
          metadata[key] = cleanString(item, 300);
        } else if (
          typeof item === "number" &&
          Number.isFinite(item)
        ) {
          metadata[key] = item;
        } else {
          metadata[key] = item;
        }
      }
    });

    return metadata;
  }

  function normalizeTimestamp(value) {
    const timestamp = cleanString(value, 50);

    if (!timestamp) return null;

    const parsed = Date.parse(timestamp);

    return Number.isNaN(parsed)
      ? null
      : new Date(parsed).toISOString();
  }

  function normalizeUser(input = {}) {
    const source = isObject(input) ? input : {};
    const profile = isObject(source.profile) ? source.profile : {};

    const address = normalizeAddress(
      firstDefined(profile.address, source.address)
    );

    const firstName = cleanString(
      firstDefined(
        source.firstName,
        source.first_name,
        profile.firstName
      ),
      100
    );

    const lastName = cleanString(
      firstDefined(
        source.lastName,
        source.last_name,
        profile.lastName
      ),
      100
    );

    const fullName = cleanString(
      firstDefined(
        source.fullName,
        source.name,
        profile.fullName,
        [firstName, lastName].filter(Boolean).join(" ")
      ),
      201
    );

    const role = normalizeRole(
      firstDefined(
        source.role,
        source.userRole,
        source.user_type,
        source.accountType
      )
    );

    const profileImage = cleanString(
      firstDefined(
        source.profileImage,
        source.avatar,
        source.photoURL,
        profile.profileImage
      ),
      1000
    );

    const verificationInput = isObject(source.verification)
      ? source.verification
      : isObject(source.verificationStatus)
        ? source.verificationStatus
        : {};

    return {
      id: cleanString(
        firstDefined(source.id, source.userId, source._id, source.uuid),
        150
      ),

      version: MODEL_VERSION,

      firstName: firstName,
      lastName: lastName,
      fullName: fullName,

      email: normalizeEmail(
        firstDefined(source.email, profile.email)
      ),

      phone: normalizePhone(
        firstDefined(source.phone, source.mobile, profile.phone)
      ),

      role: role,

      roles: normalizeArray(
        Array.isArray(source.roles) ? source.roles : [role],
        20,
        50
      ).map(normalizeRole).filter(function (item, index, array) {
        return array.indexOf(item) === index;
      }),

      status: normalizeStatus(
        firstDefined(source.status, source.accountStatus)
      ),

      profileImage: profileImage,

      profile: {
        bio: cleanString(
          firstDefined(profile.bio, source.bio),
          2000
        ),

        dateOfBirth: cleanString(
          firstDefined(
            profile.dateOfBirth,
            source.dateOfBirth,
            source.dob
          ),
          30
        ) || null,

        gender: cleanString(
          firstDefined(profile.gender, source.gender),
          50
        ),

        address: address,

        city: cleanString(
          firstDefined(profile.city, source.city, address.city),
          100
        ),

        state: cleanString(
          firstDefined(profile.state, source.state, address.state),
          100
        ),

        country: cleanString(
          firstDefined(profile.country, source.country, address.country),
          100
        ),

        postalCode: cleanString(
          firstDefined(
            profile.postalCode,
            source.postalCode,
            address.postalCode
          ),
          20
        ),

        education: normalizeEducation(
          firstDefined(profile.education, source.education)
        ),

        interests: normalizeArray(
          firstDefined(profile.interests, source.interests)
        ),

        skills: normalizeArray(
          firstDefined(profile.skills, source.skills)
        ),

        languages: normalizeArray(
          firstDefined(profile.languages, source.languages)
        ),

        website: cleanString(
          firstDefined(profile.website, source.website),
          1000
        ),

        linkedin: cleanString(
          firstDefined(profile.linkedin, source.linkedin),
          1000
        )
      },

      verification: normalizeVerificationData(verificationInput),

      preferences: normalizePreferences(
        firstDefined(source.preferences, source.settings)
      ),

      subscription: normalizeSubscription(source.subscription),

      createdAt: normalizeTimestamp(
        firstDefined(source.createdAt, source.created_at)
      ),

      updatedAt: normalizeTimestamp(
        firstDefined(source.updatedAt, source.updated_at)
      ),

      lastLoginAt: normalizeTimestamp(
        firstDefined(source.lastLoginAt, source.last_login_at)
      ),

      metadata: normalizeMetadata(source.metadata)
    };
  }

  function validateEmail(value) {
    const email = normalizeEmail(value);

    if (!email || email.length > 254) return false;

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validatePhone(value) {
    const phone = normalizePhone(value);
    const digits = phone.replace(/\D/g, "");

    return digits.length >= 7 && digits.length <= 15;
  }

  function validateDateOfBirth(value) {
    const date = cleanString(value, 30);

    if (!date) return true;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

    const parsed = new Date(date + "T00:00:00Z");

    if (Number.isNaN(parsed.getTime())) return false;

    if (parsed.toISOString().slice(0, 10) !== date) return false;

    const today = new Date();
    const todayUTC = new Date(Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate()
    ));

    return parsed <= todayUTC;
  }

  function validateUser(input = {}, options = {}) {
    const source = isObject(input) ? input : {};
    const settings = isObject(options) ? options : {};
    const user = normalizeUser(source);
    const errors = {};

    if (settings.requireId && !user.id) {
      errors.id = "User ID is required.";
    }

    if (settings.requireFirstName && !user.firstName) {
      errors.firstName = "First name is required.";
    }

    if (settings.requireLastName && !user.lastName) {
      errors.lastName = "Last name is required.";
    }

    if (settings.requireEmail && !user.email) {
      errors.email = "Email address is required.";
    } else if (user.email && !validateEmail(user.email)) {
      errors.email = "Enter a valid email address.";
    }

    if (settings.requirePhone && !user.phone) {
      errors.phone = "Phone number is required.";
    } else if (user.phone && !validatePhone(user.phone)) {
      errors.phone = "Enter a valid phone number.";
    }

    if (settings.requireRole && !source.role) {
      errors.role = "User role is required.";
    } else if (source.role && !isValidRole(source.role)) {
      errors.role = "Invalid user role.";
    }

    const dob = firstDefined(
      isObject(source.profile) ? source.profile.dateOfBirth : undefined,
      source.dateOfBirth,
      source.dob
    );

    if (dob && !validateDateOfBirth(dob)) {
      errors.dateOfBirth = "Enter a valid date of birth.";
    }

    if (
      settings.allowedRoles &&
      Array.isArray(settings.allowedRoles) &&
      settings.allowedRoles.length
    ) {
      const allowedRoles = settings.allowedRoles.map(normalizeRole);

      if (!allowedRoles.includes(user.role)) {
        errors.role = "This user role is not permitted.";
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors: errors,
      user: user
    };
  }

  function getDisplayName(user) {
    if (!user) return "User";

    const normalized = normalizeUser(user);

    return normalized.fullName ||
      normalized.email ||
      "User";
  }

  function getInitials(user) {
    if (!user) return "U";

    const normalized = normalizeUser(user);
    const name = normalized.fullName || normalized.email || "User";

    const parts = name.trim().split(/\s+/).filter(Boolean);

    return parts.slice(0, 2).map(function (part) {
      return part.charAt(0).toUpperCase();
    }).join("") || "U";
  }

  function getProfileCompletion(user) {
    const normalized = normalizeUser(user);

    const fields = [
      normalized.firstName,
      normalized.lastName,
      normalized.email,
      normalized.phone,
      normalized.profile.dateOfBirth,
      normalized.profile.gender,
      normalized.profileImage,
      normalized.profile.city,
      normalized.profile.state,
      normalized.profile.education.length > 0,
      normalized.profile.bio
    ];

    const completed = fields.filter(function (value) {
      if (typeof value === "boolean") return value;

      return value !== null &&
        value !== undefined &&
        value !== "";
    }).length;

    return Math.round((completed / fields.length) * 100);
  }

  function isEmailVerified(user) {
    return normalizeUser(user).verification.email ===
      VERIFICATION_STATUSES.VERIFIED;
  }

  function isPhoneVerified(user) {
    return normalizeUser(user).verification.phone ===
      VERIFICATION_STATUSES.VERIFIED;
  }

  function hasRole(user, role) {
    if (!user || !role) return false;

    const normalized = normalizeUser(user);
    const requestedRole = normalizeRole(role);

    return normalized.role === requestedRole ||
      normalized.roles.includes(requestedRole);
  }

  function hasAnyRole(user, roles = []) {
    return Array.isArray(roles) &&
      roles.some(function (role) {
        return hasRole(user, role);
      });
  }

  function isActive(user) {
    return normalizeUser(user).status === ACCOUNT_STATUSES.ACTIVE;
  }

  function toPublicProfile(input = {}) {
    const user = normalizeUser(input);

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      profileImage: user.profileImage,
      role: user.role,
      bio: user.profile.bio,
      city: user.profile.city,
      state: user.profile.state,
      country: user.profile.country,
      education: user.profile.education,
      interests: user.profile.interests,
      skills: user.profile.skills,
      languages: user.profile.languages,
      website: user.profile.website,
      linkedin: user.profile.linkedin
    };
  }

  function toUpdatePayload(input = {}) {
    const user = normalizeUser(input);

    return {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,

      profile: {
        bio: user.profile.bio,
        dateOfBirth: user.profile.dateOfBirth,
        gender: user.profile.gender,
        address: user.profile.address,
        city: user.profile.city,
        state: user.profile.state,
        country: user.profile.country,
        postalCode: user.profile.postalCode,
        education: user.profile.education,
        interests: user.profile.interests,
        skills: user.profile.skills,
        languages: user.profile.languages,
        website: user.profile.website,
        linkedin: user.profile.linkedin
      },

      preferences: user.preferences
    };
  }

  function updateUser(currentUser, updates = {}) {
    const current = isObject(currentUser) ? currentUser : {};
    const changes = isObject(updates) ? updates : {};

    const currentProfile = isObject(current.profile)
      ? current.profile
      : {};

    const changedProfile = isObject(changes.profile)
      ? changes.profile
      : {};

    const currentPreferences = isObject(current.preferences)
      ? current.preferences
      : {};

    const changedPreferences = isObject(changes.preferences)
      ? changes.preferences
      : {};

    const currentVerification = isObject(current.verification)
      ? current.verification
      : {};

    const changedVerification = isObject(changes.verification)
      ? changes.verification
      : {};

    const currentMetadata = isObject(current.metadata)
      ? current.metadata
      : {};

    const changedMetadata = isObject(changes.metadata)
      ? changes.metadata
      : {};

    const merged = {
      ...current,
      ...changes,

      profile: {
        ...currentProfile,
        ...changedProfile
      },

      preferences: {
        ...currentPreferences,
        ...changedPreferences
      },

      verification: {
        ...currentVerification,
        ...changedVerification
      },

      metadata: {
        ...currentMetadata,
        ...changedMetadata
      }
    };

    /*
     * Role, account status, verification state, and subscription state
     * are sensitive fields. This helper only normalizes supplied data;
     * authorization to change these values must be enforced by the server.
     */
    return normalizeUser(merged);
  }

  const api = {
    version: MODEL_VERSION,

    USER_ROLES: USER_ROLES,
    ACCOUNT_STATUSES: ACCOUNT_STATUSES,
    VERIFICATION_STATUSES: VERIFICATION_STATUSES,
    PROFILE_FIELDS: PROFILE_FIELDS,

    normalizeUser: normalizeUser,
    updateUser: updateUser,
    validateUser: validateUser,
    validateEmail: validateEmail,
    validatePhone: validatePhone,
    validateDateOfBirth: validateDateOfBirth,
    normalizeEmail: normalizeEmail,
    normalizePhone: normalizePhone,
    normalizeRole: normalizeRole,
    normalizeStatus: normalizeStatus,
    normalizeVerification: normalizeVerification,

    getDisplayName: getDisplayName,
    getInitials: getInitials,
    getProfileCompletion: getProfileCompletion,

    isEmailVerified: isEmailVerified,
    isPhoneVerified: isPhoneVerified,
    hasRole: hasRole,
    hasAnyRole: hasAnyRole,
    isActive: isActive,

    toPublicProfile: toPublicProfile,
    toUpdatePayload: toUpdatePayload
  };

  if (typeof Object.freeze === "function") {
    Object.freeze(api);
  }

  window.MedOrbitsUserModel = api;

  window.MedOrbits = window.MedOrbits || {};
  window.MedOrbits.UserModel = api;

})(window);
