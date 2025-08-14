# Requirements Document

## Introduction

Saga is an AI-powered family biography platform that facilitates meaningful intergenerational storytelling through an asynchronous conversation model. The system connects users in a **Facilitator** role (typically adult children) with their family members in a **Storyteller** role (typically parents), enabling the preservation and sharing of family memories.

The core experience is designed around a dual-platform approach: **Facilitators** can manage projects, interact with stories, and handle payments through both a feature-rich **web browser interface** and a convenient **mobile application**. The **Storyteller** experience is exclusively delivered through a highly simplified and accessible **mobile application**, optimized for AI-guided voice recording and effortless interaction. The platform's value proposition centers on creating a "structured emotional heirloom" that transforms fragmented family stories into an organized, accessible digital legacy while fostering ongoing connection between generations.

## Requirements

### Requirement 0: Unified User Model and Package-Based Resource Management

**User Story:** As a user, I want to have a single account that manages all my family story projects and roles through a flexible package/seat system, so that I can collaborate with siblings and manage multiple family stories efficiently.

#### Acceptance Criteria
1.  WHEN a person signs up THEN the system SHALL create a single core **User Account** with an associated **Resource Wallet** that tracks available seats and vouchers.
2.  WHEN a user purchases a "Saga Package" THEN the system SHALL credit their Resource Wallet with the specified number of Project Vouchers, Facilitator Seats, and Storyteller Seats as defined in the package.
3.  WHEN a user creates a new project THEN the system SHALL consume one Project Voucher from their wallet, create a **Facilitator Role** instance for that specific project, and initiate a **one-year interactive service subscription** for that project.
4.  WHEN a user invites a co-facilitator (sibling) THEN the system SHALL consume one Facilitator Seat from their wallet and grant the invitee Facilitator access to that specific project.
5.  WHEN a user invites a storyteller THEN the system SHALL consume one Storyteller Seat from their wallet and create a **Storyteller Role** instance for that specific project.
6.  WHEN a user's Resource Wallet is empty THEN the system SHALL disable creation/invitation actions and provide options to purchase additional seats "a la carte".
7.  WHEN multiple Facilitators collaborate on a project THEN the system SHALL clearly attribute all interactions (comments, questions, edits) to the specific family member who created them.
8.  TO preserve the integrity and uniqueness of a person's life story, the system SHALL enforce a global limit of **one Storyteller Role per User Account across the entire platform**. IF a user already holds a Storyteller Role, they cannot be assigned another one.
9.  **WHEN a project's one-year interactive service subscription expires THEN the system SHALL automatically transition the project into a permanent, read-only "Archival Mode".**
10. **WHEN a project is in "Archival Mode" THEN all project members SHALL be able to view and export all existing content, but the system SHALL disable all actions for adding new content or interactions (e.g., recording, commenting, editing) unless the subscription is renewed.**

### Requirement 1: User Authentication and Account Management

**User Story:** As a user, I want to create a single account and manage my authentication securely, so that I can access the platform and protect my family's data across all my roles.

#### Acceptance Criteria

1.  WHEN a new user visits the application THEN the system SHALL provide sign-up options via mobile number, Google, or Apple authentication.
2.  WHEN a user completes authentication THEN the system SHALL create a secure user session and redirect to their main dashboard or project list.
3.  WHEN a user logs out THEN the system SHALL invalidate the session and redirect to the login page.
4.  IF a user forgets their password THEN the system SHALL provide a secure password reset mechanism via their registered email or mobile number.

### Requirement 2: Project Creation and Payment Processing

**User Story:** As a user in a Facilitator role, I want to purchase resource packages to fill my wallet and then use those resources to create new Saga projects, so that I can manage my spending and project initiation separately and flexibly.

#### Acceptance Criteria

1.  WHEN a user wishes to create a project but has no Project Vouchers THEN the system SHALL guide them to the purchase screen.
2.  WHEN a user visits the purchase screen THEN the system SHALL present available "Saga Packages" with clear value propositions and pricing.
3.  WHEN a user completes a purchase THEN the system SHALL process the transaction securely and credit the corresponding resources (vouchers/seats) to the user's Resource Wallet, then return them to their dashboard.
4.  WHEN a user with an available Project Voucher initiates project creation THEN the system SHALL prompt them to name the project and confirm creation, which will consume one Project Voucher from their wallet.
5.  WHEN a project is successfully created from a voucher THEN the system SHALL navigate the user to the new project's home screen to begin the invitation process.
6.  IF payment fails THEN the system SHALL display appropriate error messages and allow retry without losing the user's context.

### Requirement 3: Storyteller Invitation and Onboarding

**User Story:** As a user in a Facilitator role, I want to invite my family member to join the project easily, so that they can begin sharing their stories without technical barriers.

#### Acceptance Criteria

1.  WHEN a user in a Facilitator role creates a project THEN the system SHALL generate a unique, secure invitation link valid for 72 hours.
2.  WHEN a Facilitator shares the invitation THEN the system SHALL provide multiple sharing options, including a standard link (via WhatsApp, SMS, email) and an **Assisted Activation** mode (QR code or magic link) for in-person setup.
3.  WHEN a potential Storyteller taps the invitation link THEN the system SHALL direct them to download the mobile app if not installed.
4.  WHEN a Storyteller opens the app via invitation THEN the system SHALL display a personalized welcome screen with one-tap join functionality.
5.  WHEN a Storyteller joins THEN the system SHALL bind them to the correct project and display a mandatory, full-screen privacy pledge for agreement.
6.  **WHEN an invitation has been sent THEN the system SHALL display the status (e.g., "Invitation sent. Awaiting acceptance.") in the Facilitator's project view. IF the link expires before being used, the system SHALL update the status to "Invite Expired" and provide a "Resend Invite" option.**

### Requirement 4: AI-Guided Story Recording with Confirmation

**User Story:** As a user in a Storyteller role, I want to record my stories using simple voice recording with AI guidance and have the opportunity to review before sending, so that I can share my memories naturally while feeling in control of what I share.

#### Acceptance Criteria

1.  WHEN a Storyteller opens the mobile app's recording screen THEN the system SHALL display an AI-generated prompt both as text and playable audio.
2.  WHEN a Storyteller presses and holds the record button THEN the system SHALL capture high-quality audio and provide clear visual feedback, such as a pulsating wave animation.
3.  WHEN a Storyteller releases the record button THEN the system SHALL navigate to a "Review & Send" screen with playback, send, and re-record options.
4.  WHEN a Storyteller is on the "Review & Send" screen THEN the system SHALL provide a "Play" button to listen back, a large "Send to Family" button, and a smaller "Re-record" or "Delete" button.
5.  WHEN a Storyteller taps "Send to Family" THEN the system SHALL upload the recording, process it through speech-to-text conversion, and store it securely.
6.  WHEN a recording is successfully sent THEN the system SHALL display a "Sent!" confirmation and return to the recording home screen.
7.  The system SHALL enforce a **10-minute time limit** and a file size limit of **< 50MB** for any single recording.
8.  IF a recording is interrupted by a crash or network failure THEN the system SHALL save a draft and offer recovery options on the next app launch.
9.  WHEN a Storyteller wants to add context THEN the system SHALL allow the attachment of a single photo per recording from the device's gallery.

### Requirement 5: Story Feed and Content Management

**User Story:** As a user in a Facilitator role, I want to view and manage all my family member's stories in an organized feed, so that I can easily consume and interact with their shared memories.

#### Acceptance Criteria

1.  WHEN new stories are uploaded THEN the system SHALL send push notifications to the Facilitator and display stories in a reverse chronological feed.
2.  WHEN a Facilitator views a story THEN the system SHALL provide audio playback, editable transcript, and photo viewing capabilities.
3.  WHEN a Facilitator edits a transcript THEN the system SHALL provide a simple text editor and all changes SHALL be saved automatically.
4.  WHEN the system detects a thematic block of questions is complete THEN the system SHALL generate and display a special "Chapter Summary" card in the feed that summarizes the key themes and stories from that chapter.
5.  WHEN a Facilitator views the story feed THEN the system SHALL provide a persistent search bar at the top to filter stories by keywords in titles or transcripts.
6.  WHEN a Facilitator uses the search functionality THEN the system SHALL return accurate results and update dynamically as they type.
7.  WHEN a Facilitator views the story feed THEN the system SHALL load content efficiently with appropriate loading states (e.g., skeleton loaders).

### Requirement 6: Multi-Facilitator Interactive Feedback System

**User Story:** As a user in a Facilitator role, I want to respond to my family member's stories with comments and follow-up questions alongside other family members, so that we can collaborate in encouraging continued sharing and exploring details together.

#### Acceptance Criteria

1.  WHEN a Facilitator views a story THEN the system SHALL provide options to leave comments or ask follow-up questions.
2.  WHEN a Facilitator submits a comment THEN the system SHALL send it to the Storyteller as a warm, read-only message of encouragement with clear attribution to the specific family member.
3.  WHEN a Facilitator submits a follow-up question THEN the system SHALL send it to the Storyteller as a new, high-priority recording prompt with clear attribution to the asking family member.
4.  WHEN multiple Facilitators interact with the same story THEN the system SHALL display all interactions with clear attribution (e.g., "Alex asked:", "Beth commented:") visible to all project members.
5.  WHEN a Storyteller receives feedback THEN the system SHALL send push notifications clearly identifying which family member provided the feedback and display all interactions within the app.
6.  WHEN a Storyteller responds to a follow-up THEN the system SHALL link the response to the original question, notify all Facilitators in the project, and clearly show which family member asked the original question.

### Requirement 7: Story Review and Management for Storytellers

**User Story:** As a user in a Storyteller role, I want to review my previously shared stories and see the responses, so that I can feel connected and motivated to continue sharing.

#### Acceptance Criteria

1.  WHEN a Storyteller uses the app THEN the system's interface SHALL be organized into clear sections, such as a **"My Stories" tab** and a **"Messages" or "Feedback" tab**, for easy navigation.
2.  WHEN a Storyteller accesses the "My Stories" section THEN the system SHALL display a chronological list of their recordings.
3.  WHEN a Storyteller views a story detail THEN the system SHALL show their audio, the AI-generated transcript, and any feedback received.
4.  WHEN a Storyteller receives a follow-up question in the feedback section THEN the system SHALL provide a prominent **"Record Answer" button** that takes them directly to the recording screen to answer that specific question.
5.  WHEN a Storyteller receives a comment THEN the system SHALL display it as read-only encouragement within the context of the relevant story.

### Requirement 8: Data Export and Ownership

**User Story:** As a user in a Facilitator role, I want to export all project data at any time, so that I have complete ownership and control over my family's digital legacy.

#### Acceptance Criteria

1.  WHEN a Facilitator requests data export THEN the system SHALL initiate an asynchronous archive creation process in the background.
2.  WHEN the archive is ready THEN the system SHALL email a secure download link, valid for 24 hours, to the Facilitator.
3.  **WHEN a Facilitator downloads the archive THEN the system SHALL provide a complete ZIP file with a well-organized folder structure, where each story has its own sub-folder containing the original audio file (`.mp3`), final edited transcript (`.txt`), original photo (`.jpg`), and a structured file of all interactions (`.json`).**
4.  WHEN export is requested THEN the system's app performance SHALL not be degraded during the background processing.
5.  IF export fails THEN the system SHALL notify the user and provide retry options.

### Requirement 9: Accessibility and User Experience

**User Story:** As a user in a Storyteller role, I want the mobile app to be accessible and easy to use, so that I can participate regardless of my comfort level with technology.

#### Acceptance Criteria

1.  WHEN a Storyteller uses the app THEN the system SHALL provide font size options (Standard, Large, Extra Large).
2.  WHEN accessibility is needed THEN the system SHALL offer a high-contrast mode, and the Storyteller app must strictly adhere to **WCAG 2.1 AA** standards.
3.  WHEN a Storyteller interacts with the app THEN all tap targets SHALL have a minimum size of 44x44dp.
4.  WHEN a user needs help THEN the system SHALL provide clear, simple instructions and help options.
5.  WHEN the app loads THEN the system SHALL complete a cold start in under 3 seconds and load the story feed in under 2 seconds.

### Requirement 10: Security and Privacy

**User Story:** As a user of the platform, I want my family's personal stories and data to be completely secure and private, so that I can trust the platform with our most precious memories.

#### Acceptance Criteria

1.  WHEN data is transmitted THEN the system SHALL encrypt all communications using industry-standard protocols.
2.  WHEN data is stored THEN the system SHALL encrypt all audio, text, and image files at rest.
3.  WHEN users access the platform THEN the system SHALL implement secure authentication and session management.
4.  WHEN payment is processed THEN the system SHALL be PCI DSS compliant.
5.  WHEN users review privacy terms THEN the system SHALL provide a transparent, easily accessible Privacy Policy, including the mandatory pledge shown during a Storyteller's onboarding.