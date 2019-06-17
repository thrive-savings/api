module.exports = {
  // Transfer Table Enum values
  TRANSFER: {
    TYPES: {
      DEBIT: 'debit',
      CREDIT: 'credit'
    },
    SUBTYPES: {
      SAVE: 'save',
      WITHDRAW: 'withdraw',
      REWARD: 'reward',
      MATCH: 'match'
    },
    STATES: {
      WAITING: 'waiting', // waiting for Thrive side attention
      QUEUED: 'queued', // queued to be sent to provider
      SENT: 'sent', // sent to provider (VersaPay or Synapse)
      PROCESSING: 'processing', // provider is processing it
      COMPLETED: 'completed', // transfer is settled
      RETURNED: 'returned', // transfer is returned, possible nsf
      CANCELED: 'canceled', // cancelled for any reason
      FAILED: 'failed' // failed for any reason
    },
    REQUEST_METHODS: {
      AUTOMATED: 'automated',
      MANUAL: 'manual'
    },
    APPROVAL_STATES: {
      NOT_NEEDED: 'not-needed',
      USER_REQUESTED: 'user-requested',
      USER_APPROVED: 'user-approved',
      USER_UNAPPROVED: 'user-unapproved',
      ADMIN_REQUESTED: 'admin-requested',
      ADMIN_APPROVED: 'admin-approved',
      ADMIN_UNAPPROVED: 'admin-unapproved'
    }
  }
}
