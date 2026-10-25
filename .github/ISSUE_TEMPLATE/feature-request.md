
name: “💡 Feature Request”
description: “Propose a feature, enhancement, or new capability for MedOrbits.”
title: “[Feature]: “
labels:
  - enhancement
assignees: []

body:
  - type: markdown
    attributes:
      value: |
        ## 💡 MedOrbits Feature Request

        Thank you for helping improve MedOrbits. Clear problem statements, realistic acceptance criteria, and thoughtful consideration of accessibility, data accuracy, and security help turn good ideas into reliable features.

        **Before submitting:**
        - Search existing issues for similar proposals.
        - Describe the problem and intended user benefit.
        - Do not include credentials, private documents, or sensitive personal information.
        - For admissions, eligibility, fees, or other consequential educational information, prefer authoritative sources.

  - type: textarea
    id: feature-summary
    attributes:
      label: Feature Summary
      description: What would you like MedOrbits to do?
      placeholder: “Provide a concise description of the proposed feature or improvement.”
    validations:
      required: true

  - type: textarea
    id: problem-opportunity
    attributes:
      label: Problem or Opportunity
      description: What problem does this feature solve?
      placeholder: |
        What is difficult or missing today?
        Who is affected?
        How is the problem currently handled?
    validations:
      required: true

  - type: checkboxes
    id: target-users
    attributes:
      label: Target Users
      description: Who would benefit from this feature? Select all that apply.
      options:
        - label: Students and applicants
        - label: Medical admission aspirants
        - label: Educational institutions
        - label: Counsellors and consultants
        - label: Job seekers and professionals
        - label: Website administrators
        - label: Developers and contributors
        - label: Other users

  - type: textarea
    id: target-user-details
    attributes:
      label: Additional User Details
      description: Describe relevant users, use cases, or user groups.
      placeholder: “Explain who needs this feature and why.”
    validations:
      required: false

  - type: textarea
    id: proposed-solution
    attributes:
      label: Proposed Solution
      description: How should the feature work?
      placeholder: |
        Explain the expected behaviour, user journey, or technical capability.

        Include examples, suggested workflows, or interface ideas where useful.
    validations:
      required: true

  - type: textarea
    id: user-journey
    attributes:
      label: User Journey
      description: Describe the intended flow from the user’s perspective.
      placeholder: |
        1. The user opens:
        2. The user selects or enters:
        3. MedOrbits responds by:
        4. The expected outcome is:

        Adjust these steps to fit your proposal.
    validations:
      required: false

  - type: checkboxes
    id: design-requirements
    attributes:
      label: Design and User Experience
      description: If the proposal involves the interface, select the relevant requirements.
      options:
        - label: Responsive mobile design
        - label: Tablet and desktop support
        - label: Accessible controls and navigation
        - label: Clear loading, success, and error states
        - label: Consistent MedOrbits design system
        - label: Reduced-motion support where applicable
        - label: Not applicable to this proposal

  - type: textarea
    id: design-references
    attributes:
      label: Visual References and Design Notes
      description: Describe mockups, screenshots, sketches, or references. Remove sensitive information from any evidence.
      placeholder: “Add design notes or explain any supporting attachments.”
    validations:
      required: false

  - type: checkboxes
    id: proposed-scope
    attributes:
      label: Proposed Scope
      description: Which areas might this feature affect? These selections describe possible impact, not a required implementation.
      options:
        - label: Frontend pages and components
        - label: CSS, styling, and animations
        - label: JavaScript interactions
        - label: Public JSON datasets
        - label: Backend services or APIs
        - label: Database or data models
        - label: Authentication and permissions
        - label: Documents and file handling
        - label: Payments or refunds
        - label: Notifications and support
        - label: Documentation
        - label: Testing and quality assurance
        - label: Deployment and operations
        - label: Other areas

  - type: textarea
    id: scope-details
    attributes:
      label: Additional Scope Details
      description: Identify relevant components, dependencies, or boundaries if known.
      placeholder: “Describe any known implementation constraints or affected modules.”
    validations:
      required: false

  - type: textarea
    id: expected-benefits
    attributes:
      label: Expected Benefits
      description: Explain how the feature would improve MedOrbits.
      placeholder: |
        What user outcome would improve?
        Would it reduce manual work or repeated support requests?
        Would it improve accuracy, accessibility, reliability, or performance?
        How could the improvement be evaluated?
    validations:
      required: true

  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives Considered
      description: Describe alternative solutions and why the proposed approach may be preferable.
      placeholder: “Enter ‘None considered yet’ if you have not evaluated alternatives.”
    validations:
      required: false

  - type: checkboxes
    id: risk-categories
    attributes:
      label: Risks and Considerations
      description: Identify potential concerns. Select all that apply.
      options:
        - label: Privacy or personal-data handling
        - label: Security or access control
        - label: Educational information accuracy
        - label: Accessibility
        - label: Performance or scalability
        - label: API or database compatibility
        - label: External service or dependency
        - label: Operational or maintenance cost
        - label: No known concerns
        - label: Other concerns

  - type: textarea
    id: risk-details
    attributes:
      label: Risk Details
      description: Explain relevant risks, dependencies, mitigations, or limitations.
      placeholder: “Describe any known concerns or enter ‘None known’.”
    validations:
      required: false

  - type: checkboxes
    id: acceptance-criteria
    attributes:
      label: Acceptance Criteria
      description: Select the criteria relevant to completing and reviewing this feature.
      options:
        - label: The intended user problem is addressed.
          required: true
        - label: The expected behaviour is documented.
          required: true
        - label: Relevant validation and error handling are included.
          required: true
        - label: Responsive design and accessibility requirements are considered.
          required: true
        - label: Relevant tests are added or updated.
          required: true
        - label: Documentation is updated where necessary.
          required: true
        - label: Security and privacy implications are addressed where applicable.
          required: true

  - type: textarea
    id: additional-acceptance-criteria
    attributes:
      label: Additional Acceptance Criteria
      description: Add specific, measurable requirements reviewers can verify.
      placeholder: |
        - [ ] Add a specific, measurable requirement.
        - [ ] Add another requirement if needed.
    validations:
      required: false

  - type: textarea
    id: related-references
    attributes:
      label: Related Issues and References
      description: Link related issues, documentation, official resources, or design references.
      placeholder: |
        Related issue:
        Documentation:
        External reference:

        For admissions, eligibility, fees, or other consequential educational information, prefer authoritative sources.
    validations:
      required: false

  - type: dropdown
    id: priority
    attributes:
      label: Requested Priority
      description: How important is this feature to the intended users? Maintainers will determine final prioritisation.
      options:
        - “Critical — essential workflow is missing or seriously blocked”
        - “High — substantial improvement to an important workflow”
        - “Medium — useful enhancement with alternatives available”
        - “Low — optional improvement or convenience”
        - “Not sure”
    validations:
      required: true

  - type: checkboxes
    id: contribution
    attributes:
      label: Contribution
      description: Would you like to help implement or validate this proposal?
      options:
        - label: I can help with implementation.
        - label: I can help with design or user research.
        - label: I can help with testing or documentation.
        - label: I can provide additional requirements.
        - label: I am proposing the idea only.

  - type: checkboxes
    id: submission-checklist
    attributes:
      label: Submission Checklist
      description: Confirm all required items before submitting.
      options:
        - label: I searched for existing issues or similar proposals.
          required: true
        - label: I explained the problem and intended benefit.
          required: true
        - label: I distinguished the proposed behaviour from existing functionality.
          required: true
        - label: I included relevant references where available.
          required: true
        - label: I removed credentials, private documents, and sensitive personal information.
          required: true
