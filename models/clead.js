import mongoose from "mongoose";

/* ================================
   ACTIVITY SCHEMA
================================ */

const activitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "Call",
        "Email",
        "Meeting",
        "WhatsApp",
        "LinkedIn",
        "Note",
        "StatusChange",
        "Task",
        "Demo",
      ],
    },

    title: String,

    description: String,

    outcome: {
      type: String,
      enum: [
        "Interested",
        "No Response",
        "Callback",
        "Meeting Scheduled",
        "Closed",
        "Rejected",
      ],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

/* ================================
   FOLLOWUP SCHEMA
================================ */

const followUpSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },

    type: {
      type: String,
      enum: [
        "Call",
        "Email",
        "Meeting",
        "WhatsApp",
        "LinkedIn",
        "Demo",
      ],
    },

    note: String,

    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },

    status: {
      type: String,
      enum: ["Pending", "Completed", "Missed", "Cancelled"],
      default: "Pending",
    },

    reminderSent: {
      type: Boolean,
      default: false,
    },

    reminderTime: Date,

    completedAt: Date,

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { _id: false }
);

/* ================================
   SOCIAL SCHEMA
================================ */

const socialSchema = new mongoose.Schema(
  {
    linkedin: String,
    website: String,
    twitter: String,
    facebook: String,
    instagram: String,
  },
  { _id: false }
);

/* ================================
   COMPANY SCHEMA
================================ */

const companySchema = new mongoose.Schema(
  {
    name: String,

    domain: {
      type: String,
      lowercase: true,
    },

    industry: String,

    companySize: String,

    headquarters: String,

    foundedYear: Number,

    annualRevenue: Number,

    employeeCount: Number,
  },
  { _id: false }
);

/* ================================
   EMAIL TRACKING
================================ */

const emailTrackingSchema = new mongoose.Schema(
  {
    sent: {
      type: Number,
      default: 0,
    },

    opened: {
      type: Number,
      default: 0,
    },

    clicked: {
      type: Number,
      default: 0,
    },

    replied: {
      type: Number,
      default: 0,
    },

    bounced: {
      type: Number,
      default: 0,
    },

    unsubscribed: {
      type: Boolean,
      default: false,
    },

    lastOpenedAt: Date,
  },
  { _id: false }
);

/* ================================
   CONTACT ATTEMPTS
================================ */

const contactAttemptSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Call", "Email", "WhatsApp", "LinkedIn"],
    },

    outcome: {
      type: String,
      enum: [
        "No Response",
        "Interested",
        "Busy",
        "Callback",
        "Meeting Scheduled",
        "Rejected",
      ],
    },

    note: String,

    attemptedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

/* ================================
   MAIN LEAD SCHEMA
================================ */

const leadSchema = new mongoose.Schema(
  {
    /* MULTI TENANT */

    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      required: true,
      index: true,
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },

    /* CONTACT INFO */

    firstName: {
      type: String,
      trim: true,
    },

    lastName: {
      type: String,
      trim: true,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    designation: String,

    email: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    phone: String,

    mobile: String,

    /* COMPANY */

    company: companySchema,

    /* SOCIALS */

    socials: socialSchema,

    /* LOCATION */

    country: String,
    state: String,
    city: String,

    /* SOURCE */

    source: {
      type: String,
      enum: [
        "Website",
        "Landing Page",
        "Contact Form",
        "Live Chat",
        "Apollo",
        "LinkedIn",
        "Cold Email",
        "Cold Call",
        "WhatsApp Outreach",
        "Google Ads",
        "Facebook Ads",
        "Instagram Ads",
        "LinkedIn Ads",
        "Referral",
        "Partner",
        "Existing Customer",
        "Trade Show",
        "Conference",
        "Webinar",
        "Imported CSV",
        "Manual Entry",
        "API",
      ],
      default: "Manual Entry",
      index: true,
    },

    /* STATUS */

    status: {
      type: String,
      enum: [
        "New",
        "Attempting",
        "Contacted",
        "Interested",
        "Negotiation",
        "Qualified",
        "Proposal Sent",
        "Converted",
        "Lost",
      ],
      default: "New",
      index: true,
    },

    /* PRIORITY */

    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },

    /* LEAD TEMPERATURE */

    temperature: {
      type: String,
      enum: ["Cold", "Warm", "Hot"],
      default: "Cold",
    },

    /* TAGS */

    tags: [String],

    /* SCORE */

    leadScore: {
      type: Number,
      default: 0,
      index: true,
    },

    estimatedValue: {
      type: Number,
      default: 0,
    },

    serviceInterest: [String],

    notes: String,

    /* PIPELINE */

    pipeline: {
      type: String,
      default: "Default Pipeline",
    },

    stagePosition: Number,

    /* FOLLOWUPS */

    followUps: [followUpSchema],

    nextFollowUp: Date,

    lastContactedAt: Date,

    /* TRACKING */

    emailOpened: {
      type: Boolean,
      default: false,
    },

    replied: {
      type: Boolean,
      default: false,
    },

    emailTracking: emailTrackingSchema,

    /* ATTEMPTS */

    contactAttempts: [contactAttemptSchema],

    /* ACTIVITIES */

    activities: [activitySchema],

    /* IMPORT INFO */

    importedFrom: String,

    importedFileName: String,

    importedAt: Date,

    /* LOST */

    lostReason: String,

    /* AI / AUTOMATION */

    engagementGuide: {
      recommendedAction: String,

      nextBestAction: {
        type: String,
        enum: [
          "Send Email",
          "Call Lead",
          "LinkedIn Connect",
          "Schedule Demo",
          "Send Proposal",
          "Follow Up",
          "Close Deal",
        ],
      },

      emailTemplate: String,

      followUpSuggestion: String,
    },

    /* COMMUNICATION PREFS */

    communicationPreference: {
      type: String,
      enum: ["Email", "Phone", "WhatsApp", "LinkedIn"],
      default: "Email",
    },
  },
  {
    timestamps: true,
  }
);

/* ================================
   INDEXES
================================ */

leadSchema.index({ agency: 1, email: 1 });

leadSchema.index({ agency: 1, status: 1 });

leadSchema.index({ agency: 1, source: 1 });

leadSchema.index({ agency: 1, leadScore: -1 });

const CLead =
  mongoose.models.CLead ||
  mongoose.model(
    "CLead",
    leadSchema
  );

export default CLead;