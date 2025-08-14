# **Product Requirements Document: Saga (AI Family Biography App) - V1.5**

## 1. Revision History
| Version | Date | Author | Revision Details |
| :--- | :--- | :--- | :--- |
| **V1.5** | YYYY-MM-DD | AIO-PM | **Major Update:** Integrated comprehensive feedback. Introduced a flexible **Package/Seat model** to support multi-facilitator collaboration (the "Sibling Problem"). Refined the core recording loop with a confirmation step for better user experience. Clarified the "post-subscription" archival mode and long-term value proposition. Enhanced data export structure and added key metrics for engagement and content depth. Updated all relevant diagrams and element lists. |
| V1.1 | YYYY-MM-DD | AI PM | Fully localized for the international market. Enhanced focus on user trust, data ownership, and a frictionless experience, based on anti-fragility stress testing. |
| V1.0 | YYYY-MM-DD | AI PM | Initial draft, defining the core MVP feature loop. |

## 2. Project Vision and Objectives

### 2.1 The Core Problem
In a fast-paced, globalized world, the stories that shape our families are becoming increasingly fragile. Geographical distance and digital noise make it difficult for adult children to connect with their parents and preserve their life experiences. Existing solutions are often one-off, project-based products (like photo books or ghostwriting services), failing to foster the ongoing, living conversation that families crave.

### 2.2 MVP Objectives
This MVP aims to validate a minimal yet complete "Family Storytelling Platform" by testing the following core hypotheses:

1.  **Product Hypothesis:** An asynchronous conversation model, centered on **"AI-guided prompts -> Parent records -> Child listens & follows up -> Parent elaborates,"** can effectively foster continuous, deep, and meaningful intergenerational connection.
2.  **Commercial Hypothesis:** Users (adult children and their families) are willing to pay for a **flexible package-based subscription** that provides seats for different roles (Facilitators, Storytellers), validating a scalable B2C2F (Business-to-Child-to-Family) model.
3.  **User Value Hypothesis:** The product provides a low-friction way for children to capture and explore their family's history, while empowering parents to feel heard, valued, and connected through the simple act of sharing their stories.
4.  **Trust & Value Hypothesis:** By guaranteeing absolute data ownership, providing an accessible and effortless experience for parents, and delivering tangible value through AI-powered organization, the product can build deep user trust and establish itself as a platform for creating a **structured emotional heirloom**, not just a collection of fragmented data.
5.  **Collaboration Hypothesis:** The platform can successfully support multiple family members (e.g., siblings) collaborating as "Facilitators" on a single family story project, enhancing the shared experience.

## 3. User Personas and Scenarios

### 3.1 Target Users

*   **User B: The Facilitator (Alex)**
    *   **Profile:** A tech-savvy adult, aged 30-50, living a busy professional life, often in a different city or country from their parents. They value digital preservation, are curious about their heritage, and feel a desire to connect more deeply with their aging parents.
    *   **Role:** **The Purchaser, The Project Manager, The Chief Archivist, The Collaborator** (with siblings).

*   **User A: The Storyteller (John)**
    *   **Profile:** A parent aged 55+, comfortable with a smartphone for basic tasks (e.g., WhatsApp, photos) but intimidated by complex apps. They have a lifetime of stories to share, a desire to be heard, and cherish their connection with their children.
    *   **Role:** **The Core Content Contributor, The Emotional Beneficiary.**

### 3.2 Core User Scenario
Alex (The Facilitator) sees a targeted ad for the "Saga" app on Instagram. The message resonates.

1.  **Purchase & Initiate:** Alex downloads the app. Convinced by the value, they purchase "The Family Saga Package," which gives them credits for 1 Saga Project, 2 Facilitator seats, and 2 Storyteller seats. They use one Project credit to create "My Dad's Story."
2.  **Invite:** Alex uses a Facilitator seat for themself and immediately consumes a Storyteller seat to generate and share a unique invitation link with their father, John, via WhatsApp.
3.  **Effortless Onboarding:** John receives the link. A single tap takes him to the App Store. Upon opening, the app greets him by name. He taps one button to accept and joins the project.
4.  **First Story:** The app interface is minimalist. A warm AI voice asks a question. John presses and holds a large button, shares a story, and attaches a photo. When he releases, he sees a simple "Review & Send" screen. He taps "Send."
5.  **Connection & Emotion:** Alex receives a notification, listens to the story, reads the transcript, and is deeply moved. Alex leaves a comment and adds a follow-up question.
6.  **Closing the Loop:** John sees his son's reaction, feels appreciated, and is inspired to share more.
7.  **Collaboration:** A week later, Alex decides to involve his sister, Beth. From the project settings, he uses his remaining Facilitator seat to send an invite to Beth, who can now also listen, comment, and ask questions, enriching the family conversation.

## 4. Feature Requirements (MVP)

### **Module 1: Facilitator's App (Alex)**

#### **1.1 Account, Packages & Projects**
*   **User Story 1.1.1: Unified Sign Up / Log In**
    *   **As a** new or returning user, **I want to** quickly sign up or log in to my single Saga account using my mobile number or social sign-on (Apple/Google), **so that** I can manage all my family story projects and roles from one place.
    *   **Acceptance Criteria**:
        1.  A single set of credentials grants access to all of a user's associated roles and projects.
        2.  The system correctly associates new roles with the existing core User Account.

*   **User Story 1.1.2: Purchase & Manage Resource Packages**
    *   **As a** logged-in user, **I want to** browse and purchase "Saga Packages" which grant my account a number of "seats" or "vouchers" (e.g., for Projects, Facilitators, Storytellers), **so that** I have the resources needed to build my family's archive.
    *   **Business Logic**:
        1.  A clear "Get Started" or "Add Resources" CTA leads to a page showcasing available **Product Packages** (e.g., "The Solo Saga" for 1 Project/1 Facilitator/1 Storyteller). For MVP, we will only offer one primary package.
        2.  The package details clearly state the value: **"Includes [X] Project creation voucher(s), [Y] Facilitator seat(s), [Z] Storyteller seat(s). Each project includes one year of full interactive service, followed by permanent 'Archival Mode' access, and one-click full data export."**
        3.  **Archival Mode Definition:** After one year, the project becomes read-only. All content can be viewed and exported, but no new stories or interactions can be added unless the subscription is renewed.
        4.  On successful payment, the user's account is credited with the purchased vouchers/seats. An account/settings page will show the user their available resources (e.g., "You have: 1 Project Voucher, 2 Facilitator Seats, 1 Storyteller Seat remaining").
        5.  Users can later purchase additional seats "a la carte" if they run out.
    *   **Acceptance Criteria**:
        1.  Project/role creation is gated by the availability of the corresponding voucher/seat in the user's account.
        2.  The user's account correctly reflects the purchased resources post-payment.
        3.  The system correctly handles the consumption of a voucher/seat when used.

#### **1.2 Inviting & Managing Members**
*   **User Story 1.2.1: Invitation**
    *   **As a** Facilitator in a project, **I want to** consume an available seat from my account to generate a unique invitation link for a Storyteller or a co-Facilitator, **so that** they can easily join the project.
    *   **Business Logic**:
        1.  Within a project, there are options to "Invite Storyteller" or "Invite Co-Facilitator". These options are disabled if the user has no corresponding seats available.
        2.  The system generates a unique, secure invitation token, valid for 72 hours.
        3.  The project's home screen updates to show the status (e.g., "Invitation to [Role] sent. Awaiting acceptance."). If the link expires, the status changes to "Invite Expired" with a "Resend Invite" option.
    *   **Acceptance Criteria**:
        1.  The generated link is unique, role-specific, and time-limited.
        2.  The invitee can successfully join and is assigned the correct role in the correct project.
        3.  The Facilitator's seat count is correctly decremented upon successful joining.

#### **1.3 The Story Feed & Interaction**
*   **User Story 1.3.1: Consuming the Story Feed**
    *   **As a** Facilitator, **I want to** see all of my parent's stories in a clean, reverse-chronological feed, and be able to perform a basic keyword search, **so that** I can easily review, engage, and find specific memories.
    *   **Business Logic**:
        1.  A push notification is sent to all Facilitators in the project when a new story is posted.
        2.  The feed contains story cards and special "Chapter Summary" cards.
        3.  A persistent search bar is available at the top of the feed to filter stories by keywords in their titles or transcripts.
    *   **Acceptance Criteria**:
        1.  New stories appear at the top of the feed in real-time.
        2.  Search results are accurate and update dynamically.

*   **User Story 1.3.2: Editing & Interacting**
    *   **As a** Facilitator, **I want to** edit the AI-generated transcript, add a "Follow-up Question," or leave a "Comment," **so that** I can correct inaccuracies, explore details, and provide emotional feedback.
    *   **Business Logic**:
        1.  Interactions from all Facilitators are visible to everyone in the project (all Facilitators and the Storyteller).
        2.  Each interaction is clearly attributed (e.g., "Alex asked:", "Beth commented:").
    *   **Acceptance Criteria**:
        1.  Edits and interactions are saved and displayed correctly with proper attribution.

#### **1.4 Account & Data Management**
*   **User Story 1.4.1: Data Export**
    *   **As** the owner of my family's data, **I want to** export the complete project archive at any time, in a well-structured format, **so that** I have ultimate control and peace of mind.
    *   **Business Logic**:
        1.  Triggers an asynchronous export process.
        2.  The exported `.zip` file must have a clear, organized folder structure.
            ```
            [Project_Name].zip
            ├── metadata.json
            └── stories/
                └── [YYYY-MM-DD_Story-Title]/
                    ├── audio.mp3
                    ├── transcript.txt
                    ├── photo.jpg
                    └── interactions.json
            ```
        3.  A secure download link is emailed to the requesting Facilitator.
    *   **Acceptance Criteria**:
        1.  The exported archive is complete and matches the specified structure.

### **Module 2: The Storyteller's App (John)**

#### **2.1 Onboarding & Home Screen**
*   **User Story 2.1.1: Accepting the Invitation**
    *   **As a** parent, **I want to** join by simply tapping a link and pressing one button, **so that** I can start sharing my stories effortlessly.
    *   **Business Logic**:
        1.  The welcome screen clearly states who invited them: "Your family ([Alex], [Beth], etc.) has invited you..."
        2.  A full-screen "Our Privacy Pledge" pop-up appears before the main interface. The text is updated to reflect potential multiple viewers: **"Everything you share is private and only visible to the family members in this project. Your stories belong to your family."**
    *   **Acceptance Criteria**:
        1.  The entire onboarding flow takes no more than 3 steps/screens.

#### **2.2 The Core Experience**
*   **User Story 2.2.1: AI-Guided Voice Recording with Confirmation**
    *   **As a** parent, **I want to** be prompted, press-and-hold to record, and then have a chance to review before sending, **so that** I feel in control and can avoid mistakes.
    *   **Business Logic**:
        1.  Home screen: AI prompt and a large "Press & Hold to Record" button.
        2.  Releasing the button navigates to a simple **"Review & Send" screen**.
        3.  The "Review & Send" screen contains: a "Play" button to listen back, a large "Send to Family" button, and a smaller "Re-record" or "Delete" button.
    *   **Acceptance Criteria**:
        1.  The record button is highly responsive.
        2.  The review step is clear and easy to navigate.

*   **User Story 2.2.2: Reviewing My Stories**
    *   **As a** storyteller, **I want** to easily find and listen to my told stories, **so that** I can reminisce.
    *   **Acceptance Criteria**:
        1.  A new story appears in the "My Stories" list immediately after being sent.

*   **User Story 2.2.3: Receiving Emotional Feedback**
    *   **As a** storyteller, **I want to** clearly see my family's comments and questions, **so that** I feel the connection.
    *   **Business Logic**:
        1.  All feedback is clearly attributed to the specific family member (e.g., "Alex asked:", "Beth commented:").
    *   **Acceptance Criteria**:
        1.  Notifications and in-app messages are clearly attributed.

### **Module 3: AI Prompt & Content Strategy (MVP)**

*   **User Story 3.1.1: Themed Prompt Progression**
    *   **As a** Product Manager, **I want** a structured library of AI prompts organized into thematic chapters, **so that** we can guide the Storyteller through a coherent and engaging narrative journey.
    *   **Business Logic**:
        1.  **Prompt Library:** A database of at least 50-75 open-ended, positive prompts for the MVP.
        2.  **Chapter Structure:** Prompts are organized into a logical sequence, e.g., "Chapter 1: Childhood Memories," "Chapter 2: Young Adulthood," etc. The system serves prompts linearly through the chapters.
        3.  **Prompt Priority:** A user-generated "Follow-up Question" from a Facilitator always takes precedence over a system-generated AI prompt.
    *   **Acceptance Criteria**:
        1.  The system correctly serves prompts according to the chapter logic.
        2.  A Facilitator's follow-up question is correctly delivered as the next prompt to the Storyteller.

## 5. Boundaries, Constraints, and Exception Handling

*   **IN-SCOPE for MVP:**
    *   **Multi-Facilitator, Single-Storyteller Model:** Multiple Facilitators can collaborate on a project with one Storyteller.
    *   Interactions limited to voice, text, and single photos per story.
    *   Mobile App only (iOS & Android).
    *   English language only.

*   **OUT-OF-SCOPE for MVP:**
    *   PDF/Physical Book Export.
    *   Video, multi-photo uploads.
    *   Multiple Storytellers in a single project (e.g., interviewing Mom and Dad together).
    *   Advanced AI Features: Automated timeline generation, smart topic discovery.

*   **Constraints:**
    *   Invitation Link: Expires in 72 hours.
    *   Recording: Max 10 minutes per recording.

*   **Exception Handling:**
    1.  **Draft Recovery:** If the app crashes during recording, on next launch, prompt the user: "You have an unsaved recording. Would you like to review it or delete it?"
    2.  **Network Awareness:** Provide user-friendly warnings for poor network status before critical actions.

## 6. Non-Functional Requirements

*   **Performance:**
    *   App cold start time < 3 seconds. Story feed load time < 2 seconds.
    *   End-to-end latency (from Storyteller sending to Facilitator being notified) < 30 seconds.
*   **Security:**
    *   All user data must be encrypted in transit and at rest.
    *   Payment processing must be PCI DSS compliant.
*   **Accessibility:**
    *   **The Storyteller's App (A) must strictly adhere to WCAG 2.1 AA standards.**
    *   Offer "Standard," "Large," and "Extra Large" text size options.
    *   Provide a high-contrast mode.
    *   All interactive elements must have a minimum tap target size of 44x44dp.
*   **Compatibility:** Support iOS 14+ and Android 8.0+ on major devices.

## 7. MVP Success Metrics

| Category | Metric | Definition | Success Criteria |
| :--- | :--- | :--- | :--- |
| **Commercial Validation** | Purchase Conversion Rate | (Users who complete a purchase / Total users who signed up) * 100% | > 5% |
| **Core Funnel** | Project Activation Rate | (Projects where a Storyteller has accepted / Total purchased projects) * 100% | > 60% |
| **Storyteller Retention** | Week 2 Storyteller Retention | % of Storytellers who record a story in their second week | > 15% |
| **Core Engagement** | Interaction Loop Rate | (% of stories that receive a comment or follow-up) * 100% | > 20% |
| **Loop Efficacy** | Feedback-Driven Engagement | % of Storytellers who record a new story within 7 days of receiving feedback | > 30% |
| **Collaboration** | **Collaboration Rate** | **% of active projects with more than one Facilitator** | **> 10%** |
| **Content Quality** | **Average Recording Length** | **The average duration in seconds of a story recording** | **Trending upwards** |
| **Engagement Speed** | **Median Time to Interaction** | **The median time from a story being posted to receiving its first interaction** | **< 24 hours** |
| **Technical Quality** | STT Edit Rate (Proxy) | Average number of characters edited per 100 words of transcript | < 5 |

## 8. Open Questions / TBD

1.  **"The Saga Package" Pricing:** Propose a benchmark of **$99 - $149 USD** for the one-year package, subject to market research. Pricing for "a la carte" seat purchases needs to be defined.
2.  **STT Vendor Selection:** A formal bake-off is required to test leading providers on diverse English accents.
3.  **Storyteller Onboarding Tutorial:** Finalize the new user tutorial with the UI/UX team.
4.  **Push Notification Copy:** Craft notification messages optimized for engagement.
5.  **Future Value Proposition:** How do we message the future value of physical book printing in our initial marketing without over-promising?

---
## Appendix

### **Diagram 1: Business Process Flowchart**

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'fontFamily': 'Arial, sans-serif'}}}%%
graph TD
    subgraph Facilitator (Alex & Collaborators)
        B1(Discovers Saga) --> B2(Signs up/Logs in)
        B2 --> B3{Has resources?}
        B3 -- No --> B4(Purchases "Saga Package")
        B4 -- Success --> B_Dash(Enters Dashboard<br/>Views available seats)
        B_Dash -- Has Project Voucher --> B5(Consumes Voucher<br/>Creates Saga Project)
        B5 --> B6(Enters Project)
        B6 --> B7(Invites Storyteller<br/>Consumes Storyteller Seat)
        B6 --> B8(Invites Co-Facilitator<br/>Consumes Facilitator Seat)
        B7 --> B9(Shares invite link)
        B8 --> B9
        
        B_Home(Project Home<br/>Views Story Feed) --> B10(Opens Story Detail)
        B10 --> B11(Edits transcript /<br/>Adds Comment /<br/>Asks Follow-up)
        
        B_Home --> B12(Goes to Settings)
        B12 --> B13(Requests Full Archive Export)
        B13 --> B14(Checks email for download)
    end

    subgraph "Saga" App System (Backend)
        S1(Handles Auth)
        S_Pay(Processes Payment<br/>Credits Account with Seats)
        S2(Creates Project<br/>Consumes Project Voucher)
        S3(Generates unique invite<br/>Consumes Role Seat upon acceptance)
        S4(Binds User to Project/Role)
        S5(Pushes AI-guided prompt)
        S6(Receives audio/photo)
        S7(Calls STT Engine)
        S8(Processes story<br/>Pushes notification to Facilitators)
        S9(Receives interaction<br/>Pushes notification to Storyteller)
        S12(Processes export request)
        S13(Emails secure download link)
    end

    subgraph Storyteller (John)
        A1(Receives Invite Link) --> A2(Taps link<br/>Opens App)
        A2 --> A3(Accepts Invite & Privacy Pledge)
        A3 --> A_Home(Enters Recording Home)
        A_Home --> A4(Listens to/Reads AI Prompt)
        A4 --> A5(Press & Hold to Record)
        A5 -- Release --> A6(Enters "Review & Send" Screen)
        A6 --> A7(Taps "Send")
        A7 --> A8(Views "Sent!" confirmation)
        A6 --> A_Home -- Re-record --> A5

        A13(Receives Push from Alex/Beth) --> A14(Opens App to view message)
        A14 -- Taps message --> A15(Reads feedback in Story Detail)
        A15 -- Has Follow-up --> A_Home
    end

    %% Flow Connections
    B4 --> S_Pay --> B_Dash
    B5 --> S2
    B9 --> A1
    A3 --> S3 --> S4 --> B_Home & A_Home
    A_Home --> S5 --> A4
    A7 --> S6 --> S7 --> S8 --> B_Home
    B11 --> S9 --> A13
    B13 --> S12 --> S13 --> B14
```

### **Diagram 2: Product Structure Diagram**

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'fontFamily': 'Arial, sans-serif'}}}%%
mindmap
  root((Saga Unified Platform<br/>MVP V1.5))
    ::icon(fa fa-users)
    
    **Unified User Account**
        ::icon(fa fa-user-circle)
        Core Profile (Name, Auth Details)
        **Resource Wallet**
            ::icon(fa fa-wallet)
            Project Vouchers
            Facilitator Seats
            Storyteller Seats
        **Role Management**
            Manages roles across different projects
    
    subgraph "Saga Project"
        ::icon(fa fa-book)
        **Facilitator(s)**
          ::icon(fa fa-user-edit)
          Manages the project
          Invites others
          Interacts with stories
        **Storyteller(s)**
          ::icon(fa fa-microphone-alt)
          Records stories
          Receives feedback
        **Project Data**
          Stories (Audio, Text, Photo)
          Interactions
    
    subgraph Backend & General Services
        ::icon(fa fa-server)
        **User & Role Hub**
            Unified Account System
            Role-Based Access Control (RBAC)
        **Business & Commerce Engine**
            **Product Package Management**
                ::icon(fa fa-box-open)
                Package Definitions (Seats, Duration)
                A La Carte Seat Purchasing
                Payment Gateway APIs
                **Seat/License Allocation Engine**
                    ::icon(fa fa-ticket-alt)
                    Credits seats to User Wallet
                    Consumes seats on use
        **Core Story Engine**
            Story Data Management
            STT Service Integration
            AI Prompt Library & Delivery Logic
            Notification Service
        **Data & Security**
            Data Export Service
            Data Encryption

```

### **Diagram 3: Page Flow Diagram**

#### **Journey 1: Facilitator - From Download to Project Launch (Updated)**
```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'fontFamily': 'Arial, sans-serif'}}}%%
graph TD
    A[Launch App] --> B[Sign Up/In Screen]
    B -- Auth Success --> C[User Dashboard]
    C --> D{Has Project Voucher?}
    D -- No --> E[Product Package Screen]
    E -- Taps "Purchase" --> F[Native Payment Sheet]
    F -- Success --> G[Dashboard updates<br/>Shows available seats/vouchers]
    D -- Yes --> G
    G -- Taps "Create Project" --> H[Consume Voucher & Name Project Screen]
    H --> I[Project Home (Empty State)<br/>Elements: "Invite Storyteller", "Invite Co-Facilitator"]
```

#### **Journey 2: Storyteller - From Invitation to Ready-to-Record (Updated)**
```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'fontFamily': 'Arial, sans-serif'}}}%%
graph TD
    A[Taps invite link] --> B{App installed?}
    B -- No --> C[App Store] --> D[Install App]
    B -- Yes --> D
    D --> E[App opens to Invite Screen<br/>"The Smith Family has invited you..."]
    E -- Taps "Accept" --> F["Our Privacy Pledge" Pop-up<br/>"Visible to members of this project..."]
    F -- Taps "Agree" --> G[Recording Home Screen]
```

#### **Journey 3: The Core Interaction Loop (Updated with Confirmation Step)**
```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'fontFamily': 'Arial, sans-serif'}}}%%
graph TD
    subgraph Storyteller's Flow (John)
        A1[Recording Home Screen] -- Press & Hold --> A2[Recording UI]
        A2 -- Release button --> A3["Review & Send" Screen<br/>Elements: Play button, Send button, Re-record button]
        A3 -- Taps "Send" --> A4[Uploading Indicator]
        A4 -- Success --> A5["Sent!" Toast<br/>Returns to Recording Home]
    end

    subgraph Facilitator's Flow (Alex)
        B1[Receives push] -- Taps Push --> B2[Project Home (Story Feed)]
        B2 -- Taps story --> B3[Story Detail Screen]
        B3 -- Sends comment/follow-up --> B4[Interaction Sent]
    end
    
    A4 -->|Backend Processing| B1
    B4 -->|Backend Processing| A_Push(Push sent to Storyteller)
```

#### **Journey 4: Facilitator - Data Export Flow**
*(No change to this flow)*
```mermaid
graph TD
    A[Project Home] --> B[Navigates to "Settings"]
    B -- Taps "Export" --> C[Confirmation Dialog]
    C -- Taps "Confirm" --> D[Processing Indicator]
    D --> E[User checks email]
    E --> F[Email with download link]
    F -- Clicks link --> G[Browser downloads .zip]
```

#### **Journey 5: Facilitator - Inviting a Co-Facilitator (New)**
```mermaid
graph TD
    A[Project Home] --> B[Navigates to Project Settings / Members]
    B --> C[Member List Screen<br/>Elements: List of current members, "Invite Co-Facilitator" button]
    C --> D{Has Facilitator Seat?}
    D -- Yes --> E[Taps "Invite"]
    E --> F[Confirmation Dialog<br/>"This will use one Facilitator seat. Proceed?"]
    F -- Confirms --> G[Share Invitation Sheet]
    G --> H[Link shared with sibling]
    D -- No --> I[Button disabled or prompts to buy more seats]
```

### **List 1: Pages And Elements List**

### **A. Universal / Cross-App Components**

These components are used across both the Facilitator and Storyteller apps.

#### **1. Splash Screen**
*   **Purpose:** Initial app loading and branding.
*   **Platform:** Mobile
*   **Elements:**
    *   `App Logo`: Centered on the screen.
    *   `Loading Indicator` (optional): Subtle animation.

#### **2. Sign Up / Log In Screen**
*   **Purpose:** Authenticate any user (Facilitator or Storyteller) into their unified account.
*   **Platform:** Mobile, Web (for Facilitator)
*   **Elements:**
    *   `App Logo`
    *   `Tagline`: e.g., "Your family's story, a conversation away."
    *   `Social Auth Buttons`:
        *   `Sign in with Apple` (Button): **Interaction** -> Initiates Apple Sign-In flow.
        *   `Sign in with Google` (Button): **Interaction** -> Initiates Google Sign-In flow.
    *   `Email/Phone Auth Group`:
        *   `Input Field`: For mobile number or email address.
        *   `Continue` (Button): **Interaction** -> Validates input and navigates to the OTP/password screen. **State:** Disabled until input is valid.
    *   `Footer Links`:
        *   `Terms of Service` (Text Link): **Interaction** -> Opens a web view or modal with the ToS.
        *   `Privacy Policy` (Text Link): **Interaction** -> Opens a web view or modal with the Privacy Policy.

#### **3. Phone/Email Verification Screen**
*   **Purpose:** Verify the user's identity via a one-time password (OTP).
*   **Platform:** Mobile, Web (for Facilitator)
*   **Elements:**
    *   `Header Text`: e.g., "Enter Verification Code"
    *   `Instructional Text`: e.g., "We sent a code to [user's phone/email]."
    *   `OTP Input Fields`: Typically 6 individual boxes that auto-focus to the next.
    *   `Verify & Continue` (Button): **Interaction** -> Submits the OTP for validation.
    *   `Resend Code` (Text Link):
        *   **Interaction:** Triggers a new OTP to be sent.
        *   **State: Cooldown:** Disabled, shows a countdown timer (e.g., "Resend in 59s").
        *   **State: Active:** Enabled after the countdown finishes.

#### **4. System Dialogs & Modals**
*   **Purpose:** Provide contextual information or require user action.
*   **Platform:** Mobile, Web
*   **Elements:**
    *   `Confirmation Dialog`: (e.g., for Logout, Delete, Export)
        *   `Title`, `Message Text`, `Confirm Button`, `Cancel Button`.
    *   `Error Dialog`: (e.g., for invalid input, server error)
        *   `Title`, `Error Message`, `OK Button`.
    *   `Network Status Indicator (Toast/Snackbar)`:
        *   A non-intrusive banner that appears at the top/bottom.
        *   **Message:** "No internet connection. Some features may be unavailable." or "Connecting..."

---

### **B. Facilitator App (Alex - The Power User)**

**Design Principle:** Provide comprehensive tools for management, interaction, and curation. A web-based dashboard is highly recommended for a better experience with these complex tasks.

#### **1. Facilitator Dashboard / Project List Screen**
*   **Purpose:** Central hub to view all managed projects and available resources.
*   **Platform:** Mobile, **Web (Primary)**
*   **States & Elements:**
    *   **Loading State:**
        *   `Skeleton UI`: Shimmering placeholders for the header and project cards.
    *   **Empty State (First-time user after sign-up):**
        *   `Welcome Header`: "Welcome, [Alex]!"
        *   `Empty State Illustration`
        *   `Introductory Text`: "Let's start by creating a home for your family's stories."
        *   `Create a New Saga` (Primary CTA Button): **Interaction** -> Navigates to the Package Purchase Screen.
    *   **Populated State:**
        *   `Header`: "My Sagas"
        *   `Resource Wallet Summary`: A compact view showing available seats. e.g., "Seats available: 1 Project, 0 Facilitator, 1 Storyteller". **Interaction:** Tapping this could lead to the full resource management screen.
        *   `Project List` (Scrollable/Grid):
            *   `Project Card` (for each project):
                *   `Project Title`: e.g., "Dad's Life Story"
                *   `Storyteller Avatar/Name`: "John Doe"
                *   `Co-Facilitator Avatars`: Small icons for other siblings.
                *   `Status Badge` (dynamic): "Active", "1 New Story!", "Invite Sent", "Invite Expired".
                *   **Interaction:** Tapping the card navigates to the Project Home/Story Feed for that project.
        *   `Create New Saga` (Floating Action Button on Mobile / Header Button on Web): **Interaction** -> Checks for available Project Vouchers. If available, proceeds to creation. If not, prompts to buy a package.

#### **2. Resource & Purchase Module**
*   **Purpose:** To handle all monetization and resource allocation.
*   **Platform:** Mobile, Web

##### **2.1. The Saga Package (Purchase) Screen**
*   **Elements:**
    *   `Header`
    *   `Value Proposition Section`: Bulleted list with icons explaining benefits.
    *   `Package Details Card`: Shows price and exactly what seats are included.
    *   `Purchase Now` (Button): **Interaction** -> Initiates native payment flow (Apple/Google Pay on Mobile, Stripe on Web).
    *   `Restore Purchase` (Text Link on Mobile): For App Store compliance.
    *   `Terms of Sale` (Text Link).

##### **2.2. Resource Management Screen**
*   **Purpose:** A detailed view of a user's "wallet" and options to buy more.
*   **Elements:**
    *   `Header`: "My Resources"
    *   `List of Available Seats`:
        *   `Project Vouchers`: "You have 1 Project voucher(s)."
        *   `Facilitator Seats`: "You have 0 Facilitator seat(s) available."
        *   `Storyteller Seats`: "You have 1 Storyteller seat(s) available."
    *   `Purchase More Resources` (Section):
        *   Cards for purchasing individual seats "a la carte".
        *   `Buy More Seats` (Button): **Interaction** -> Initiates payment flow for the selected item.

#### **3. Project Home / Story Feed Screen**
*   **Purpose:** Main interaction hub for a specific project.
*   **Platform:** Mobile, Web
*   **States & Elements:**
    *   **Header:**
        *   `Project Title`: "Dad's Life Story"
        *   `Project Settings` (Cogwheel Icon): **Interaction** -> Navigates to Project Settings/Member Management.
    *   **Awaiting Invitation State:**
        *   `Central View`:
            *   `Instructional Text`: "Invite a Storyteller to begin."
            *   `Invite Storyteller` (Button): **Interaction** -> Checks for seat, then opens invitation flow.
    *   **Populated State:**
        *   `Search Bar`: "Search stories...". **Interaction:** As the user types, the feed below filters in real-time.
        *   `Reverse-Chronological Story Feed` (Scrollable):
            *   `Standard Story Card`:
                *   `AI-Suggested Title`
                *   `Timestamp` and `Storyteller Name`
                *   `Embedded Audio Player` (Mini version: Play/Pause, Progress Bar)
                *   `Transcript Snippet`
                *   `Photo Thumbnail` (if attached)
                *   `Interaction Summary`: e.g., "💬 3 Comments  ❓ 1 Follow-up"
            *   `Chapter Summary Card`: Distinctive design. Title and AI-generated text.
            *   **Interaction:** Tapping any card navigates to the Story Detail Screen.

#### **4. Story Detail Screen**
*   **Purpose:** Full view of one story and its associated interactions.
*   **Platform:** Mobile, Web
*   **Elements:**
    *   `Back Navigation`
    *   `Story Title` (Editable Text Field): **Interaction:** Tapping allows editing.
    *   `Full-Size Photo Viewer`: **Interaction:** Tapping photo opens a full-screen, zoomable view.
    *   `Full Audio Player`:
        *   `Play/Pause Button`
        *   `Scrubber` (Progress Bar): Draggable to seek.
        *   `Playback Speed Control`: (Dropdown/Button: 1x, 1.25x, 1.5x, 2x)
    *   `Transcript Section`:
        *   `Full Transcript Text`: Sync-highlighted as audio plays.
        *   `Edit` (Button/Icon): **Interaction:** Navigates to Transcript Edit Screen.
    *   `Interaction Section` (Chronological):
        *   `Interaction Item`: For each comment/question.
            *   `Facilitator Avatar/Name`
            *   `Interaction Text`
            *   `Timestamp`
        *   `Interaction Input Group`:
            *   `Comment Input Field`: "Leave a comment..."
            *   `Follow-up Input Field`: "Ask a follow-up question..."
            *   `Send` (Button): **State:** Disabled until text is entered. **Interaction:** Posts the interaction to the feed.

#### **5. Project Settings / Member Management Screen**
*   **Purpose:** Manage project details and user roles.
*   **Platform:** Mobile, Web (Primary)
*   **Elements:**
    *   `Header`: "Project Settings"
    *   `Project Name` (Editable Field)
    *   `Members Section`:
        *   `List of Current Members`:
            *   `Member Item`: Avatar, Name, Role (e.g., "John Doe - Storyteller", "Beth Smith - Facilitator").
            *   `Remove` (Icon/Button, for non-primary facilitators): **Interaction** -> Opens confirmation dialog.
        *   `Invite Co-Facilitator` (Button): **State:** Disabled if no seats available. **Interaction:** Checks for seat, then opens share sheet.
        *   `Invite Storyteller` (Button): **State:** Hidden if role is already filled.
    *   `Data Section`:
        *   `Export Full Archive` (Button): **Interaction** -> Opens confirmation dialog.
    *   `Danger Zone`:
        *   `Delete Project` (Button): **Interaction** -> Opens a high-friction confirmation dialog (e.g., requires typing project name).

---

### **C. Storyteller App (John - The Contributor)**

**Design Principle:** Extreme simplicity, clarity, and accessibility. Minimal cognitive load.

#### **1. Onboarding Module**
*   **Purpose:** Effortless entry into the app and project.
*   **Platform:** Mobile

##### **1.1. Invitation Landing Screen**
*   **Elements:**
    *   `Large, Friendly Greeting`: "[Alex] and [Beth] have invited you to share your story."
    *   `Accept & Join` (Single, Prominent Button): **Interaction** -> Navigates to Privacy Pledge.

##### **1.2. "Our Privacy Pledge" Screen**
*   **Elements:**
    *   `Header`: "Your Stories are Private"
    *   `Simple, Large-Font Text`: "Everything you share is only visible to the family members in this project."
    *   `I Understand and Agree` (Single, Prominent Button): **Interaction** -> Completes onboarding, navigates to Recording Home.

#### **2. Recording Home Screen**
*   **Purpose:** The single, focused point of content creation.
*   **Platform:** Mobile
*   **Elements & States:**
    *   `AI Prompt Section` (Top):
        *   `Prompt Text` (Large font).
        *   `Hear Prompt` (Play Icon): **Interaction** -> Plays a pre-recorded, friendly voice reading the prompt.
    *   `Core Interaction Area` (Center):
        *   `Record Button`:
            *   **Idle State:** Large circle with "Press & Hold to Record" text/icon.
            *   **Recording State:** **Interaction:** On press-and-hold -> Button transforms into a pulsating wave animation. A `Timer` appears. An `Add Photo` icon appears nearby. Text changes to "Release to review".
            *   **Interaction:** On release -> Navigates to the "Review & Send" screen.
    *   `Bottom Navigation Bar`:
        *   `Record` (Tab): Selected state.
        *   `My Stories` (Tab)
        *   `Messages` (Tab): **State:** Shows a notification badge when new feedback arrives.

#### **3. Review & Send Screen**
*   **Purpose:** Provide a safety net before sending a story.
*   **Platform:** Mobile
*   **Elements:**
    *   `Header`: "Review Your Story"
    *   `Audio Player`: Simple `Play/Pause` button to listen back to the recording.
    *   `Send to Family` (Large, Primary Button): **Interaction** -> Initiates upload, shows progress, then returns to Recording Home.
    *   `Re-record` (Secondary Button): **Interaction** -> Discards the current recording and returns to the Recording Home screen to try again.
    *   `Delete` (Text Link/Icon): **Interaction** -> Opens confirmation dialog, then discards and returns home.

#### **4. "My Stories" / "Messages" Screens**
*   **Purpose:** Review past contributions and see family feedback.
*   **Platform:** Mobile

##### **4.1. "My Stories" List Screen**
*   **Elements:**
    *   `Header`: "My Stories"
    *   `Simple Chronological List` of told stories:
        *   `Story List Item`: Title/Snippet, Date. `Notification Indicator` for new feedback.
        *   **Interaction:** Tapping navigates to the Story Detail Screen.

##### **4.2. "Messages" List Screen**
*   **Elements:**
    *   `Header`: "Messages from Family"
    *   `List of Interaction Cards`:
        *   `Interaction Card`: Avatar of family member, snippet of their comment/question, timestamp.
        *   **Interaction:** Tapping navigates to the relevant story in the Story Detail Screen.

#### **5. Story Detail Screen (Storyteller's View)**
*   **Purpose:** View a single story and the feedback on it.
*   **Platform:** Mobile
*   **Elements:**
    *   `Back Navigation`
    *   `Story Title` (Read-only)
    *   `Photo` (if attached)
    *   `Audio Player` (to listen to their own voice)
    *   `Feedback Section`:
        *   `List of Feedback Items`:
            *   `Comment Item`: Avatar, Name, and comment text.
            *   `Follow-up Question Item`: Avatar, Name, question text, and a prominent `Record Answer` (Button) next to it.
            *   **Interaction:** Tapping `Record Answer` navigates the user directly to the Recording Home screen, with the follow-up question pre-loaded as the new prompt.

#### **6. Settings Screen (Storyteller's View)**
*   **Purpose:** Essential accessibility and account options.
*   **Platform:** Mobile
*   **Elements:**
    *   `Header`: "Settings"
    *   `Accessibility Section`:
        *   `Font Size` (Segmented Control: Standard | Large | Extra Large). **Interaction:** Immediately changes app-wide font size.
        *   `High-Contrast Mode` (Toggle Switch). **Interaction:** Immediately applies a high-contrast theme.
    *   `Help` (Link/Row)
    *   `Log Out` (Button)