"use client"
import React from "react"
import Link from "next/link"

interface Section {
  id: number
  title: string
  subsections: { heading: string; body: string }[]
}

const Logo = () => (
  <svg
    width="206"
    height="156"
    viewBox="0 0 206 156"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="h-10 w-auto sm:h-12"
  >
    <path
      d="M85.3772 32.024L16.1691 18.3645C10.9033 17.3252 6 21.3553 6 26.7227C6 30.8625 8.97598 34.4031 13.0541 35.1152L72.9119 45.5665C76.784 46.2426 79.6096 49.6043 79.6096 53.535C79.6096 57.649 76.5216 61.1077 72.4339 61.5723L51.7716 63.9202C42.8656 64.9323 39.49 76.1065 46.3462 81.8801C48.8875 84.0202 52.311 84.7903 55.5239 83.9448L86.0883 75.9016C91.2213 74.5508 94.7989 69.9099 94.7989 64.6022V43.4869C94.7989 37.9062 90.8523 33.1046 85.3772 32.024Z"
      fill="black"
      stroke="black"
      strokeWidth="11.6841"
    />
    <path
      d="M120.579 32.024L189.787 18.3645C195.053 17.3252 199.956 21.3553 199.956 26.7227C199.956 30.8625 196.98 34.4031 192.902 35.1152L133.044 45.5665C129.172 46.2426 126.346 49.6043 126.346 53.535C126.346 57.649 129.434 61.1077 133.522 61.5723L153.915 63.8896C162.691 64.8869 165.865 76.0069 158.939 81.4872C156.537 83.3876 153.391 84.069 150.418 83.3327L120.032 75.8074C114.819 74.5162 111.157 69.837 111.157 64.466V43.4869C111.157 37.9062 115.104 33.1046 120.579 32.024Z"
      fill="black"
      stroke="black"
      strokeWidth="11.6841"
    />
    <path
      d="M102.979 5.8418H105.315C107.897 5.84184 109.989 7.9345 109.989 10.5156C109.989 13.0968 107.897 15.1894 105.315 15.1895H102.979C100.397 15.1894 98.3047 13.0968 98.3047 10.5156C98.3047 7.93448 100.397 5.84181 102.979 5.8418Z"
      fill="black"
      stroke="black"
      strokeWidth="11.6841"
    />
    <path
      d="M111.157 143.714V66.5989C111.157 63.3724 113.773 60.7568 116.999 60.7568C120.226 60.7568 122.841 63.3724 122.841 66.5989V143.714C122.841 146.94 120.226 149.556 116.999 149.556C113.773 149.556 111.157 146.94 111.157 143.714Z"
      fill="black"
      stroke="black"
      strokeWidth="11.6841"
    />
  </svg>
)

export default function PrivacyPolicy() {
  const sections: Section[] = [
    {
      id: 1,
      title: "Scope, Interpretation and Defined Terms",
      subsections: [
        {
          heading: "Scope of this Policy",
          body: "This Privacy Policy (hereinafter \"Policy\") is issued by Force LLC, whose registered place of business is situated at BD 37 Block 1 Natural Green, Kolkata 700101, West Bengal, India (variously referred to as \"the Company\", \"We\", \"Us\", or \"Our\" throughout this document). This Policy governs the collection, processing, storage, use, disclosure, transfer, and deletion of information â€” including information that relates to identified or identifiable natural persons â€” obtained in connection with your access to or use of the Force application and any associated web properties, services, features, or content (collectively, the \"Service\"). By accessing the Service, creating an account, or otherwise engaging with any part of the Force platform, you signify your acknowledgment of, and agreement to be bound by, the terms of this Policy in their entirety. If you do not agree with any provision herein, you must immediately cease use of the Service."
        },
        {
          heading: "Interpretation",
          body: "Throughout this Policy, words and phrases whose initial letters are capitalized carry the specific meanings assigned to them in the Definitions subsection below, and such meanings shall apply uniformly whether those terms appear in the singular or plural form. The use of the word \"including\" or \"includes\" shall be interpreted as meaning \"including without limitation\". References to any statute or regulation shall be construed as references to that statute or regulation as amended, re-enacted, or replaced from time to time. Headings and section titles are provided for convenience only and shall not affect the interpretation of any provision of this Policy. Any reference to a \"third party\" means any natural or legal person other than the Company and the user to whom this Policy is addressed."
        },
        {
          heading: "Defined Terms",
          body: "For the purposes of this Policy, the following definitions apply. An \"Account\" refers to the unique, password-protected account credential set created by or on behalf of an individual user as a prerequisite to accessing restricted portions of the Service. An \"Affiliate\" designates any legal entity that exercises control over, is subject to the control of, or shares common control with the Company, where the term \"control\" connotes the holding â€” directly or indirectly â€” of fifty percent (50%) or more of the share capital, equity interests, or voting securities entitling the holder to elect directors or equivalent governing authority. \"Application\" denotes the Force software program, inclusive of all its components, modules, features, interfaces, and updates, as made available to end users through web-based or mobile delivery channels. \"Device\" encompasses any computing apparatus capable of establishing a connection to the Service, including but not confined to personal computers, notebook computers, tablet computers, smartphones, and any other internet-enabled hardware. \"Personal Data\" or \"Personal Information\" means any information that, alone or in combination with other data accessible to the Company, relates to, identifies, or is reasonably capable of identifying a specific natural person; both terms are used interchangeably throughout this document except where applicable law prescribes the use of a particular term. \"Service Provider\" is any natural person or corporate entity that processes Personal Data on behalf of the Company pursuant to a written data processing arrangement, including sub-processors and independent contractors engaged to facilitate, support, or analyze use of the Service. \"Usage Data\" refers to technical and behavioral data generated automatically through a user's interaction with the Service or through the Service's underlying infrastructure, including without limitation Internet Protocol addresses, browser characteristics, session durations, click-path data, feature engagement logs, and device diagnostic information. \"You\" or \"Your\" means the individual user accessing or using the Service, or â€” where the user acts in a representative capacity on behalf of a company or other legal entity â€” that entity itself."
        }
      ]
    },
    {
      id: 2,
      title: "Categories of Information We Collect and Our Lawful Basis for Processing",
      subsections: [
        {
          heading: "Account and Identity Information",
          body: "When you register for the Service or create an Account, we collect certain identifying information that you furnish directly to Us. This information includes, but is not limited to, your electronic mail address, your given name and family name, a username of your choosing that constitutes your public-facing identifier within the Service, a profile photograph or avatar image that you elect to upload, and, where you authenticate via a federated identity mechanism such as Google OAuth 2.0, any profile attributes that the identity provider transmits to Us in accordance with the scope of permissions you have authorized â€” which ordinarily encompasses your verified email address, display name, and profile picture at minimum. We collect this category of information on the basis of contractual necessity: it is required to establish and maintain your Account and to deliver the core functionality of the Service in the manner described in our Terms and Conditions. The completeness and accuracy of this information is your responsibility, and you represent and warrant that any information you provide is truthful, current, and not misleading."
        },
        {
          heading: "Journal Content and User-Generated Material",
          body: "The Service is fundamentally designed to receive, store, and process the personal written content, reflections, observations, and creative output that you voluntarily enter into the journaling interface (hereinafter \"Journal Content\"). Journal Content encompasses, without limitation, the text of your journal entries, titles and headings you assign thereto, mood and emotional state indicators you select or input, energy-level readings and wellness check-in data you supply, thematic classifications and category tags applied to entries, and any structured or semi-structured data fields you complete within the journaling workflow. In addition to written material, the Service accepts and processes media attachments including photographic images, video recordings, and audio recordings that you upload or record directly within the application. It is important that you understand that Journal Content is processed by third-party artificial intelligence computing services as described in greater detail in Section 3 of this Policy. We process Journal Content on the basis of the performance of our contract with you and, where applicable, on the basis of your explicit consent obtained at the time of feature activation."
        },
        {
          heading: "Automatically Collected Technical and Behavioral Data",
          body: "The Service automatically captures and records a range of technical and behavioral data whenever you access or interact with the Service, irrespective of whether you have completed registration or are authenticated. This category of automatically collected information encompasses, but is not restricted to: the Internet Protocol (IP) address assigned to your Device at the time of access; the type, manufacturer, model, and operating system of your Device; the name, version, and configuration of the web browser or mobile application client through which you access the Service; the specific uniform resource locator (URL) path of each page or screen within the Service that you visit or navigate to; precise timestamps recording when each session is initiated and terminated and when individual pages or features are accessed; the duration of time spent on each page, screen, or feature; the referring URL from which you arrived at the Service, if any; any search queries or navigation actions you perform within the Service; unique device identifiers and persistent identifiers such as advertising identifiers; and other diagnostic, performance, and session-level telemetry data generated in the ordinary course of operating the Service infrastructure. When you access the Service through a mobile device, certain additional mobile-specific information may be collected, including your mobile carrier, the mobile network to which your device is connected, and hardware-level sensor data available through the device's operating system application programming interfaces."
        },
        {
          heading: "Cookies, Local Storage, and Similar Tracking Mechanisms",
          body: "We employ cookies, web storage mechanisms (including localStorage and sessionStorage), pixel tags, web beacons, and similar client-side persistent and session-based tracking technologies to support the operation of the Service, to maintain the continuity and security of your authenticated session, to remember your preferences and configuration settings, and to collect the behavioral and usage information described in this Policy. Session cookies, which are temporary files deleted from your Device upon termination of your browser session, are used exclusively to manage authentication state and to preserve navigational context between page loads; these are technically essential and cannot be disabled without impairing your ability to use the Service. Persistent cookies, which remain stored on your Device for a defined period after a session concludes, are used by Us and by Our third-party analytics partners to track return visits, to measure the reach and effectiveness of marketing communications, and to compile aggregated statistical profiles of Service usage. You may configure your web browser to refuse cookies, to alert you when cookies are being set, or to delete cookies stored on your Device; however, certain features of the Service depend on cookie functionality and may be unavailable or impaired if you disable cookies. The third-party analytics and tracking services that set their own cookies in connection with the Service are identified in Section 4 of this Policy."
        },
        {
          heading: "Information Collected Through Voice and Audio Features",
          body: "To the extent that you elect to use voice journaling, audio-based energy check-in, or any other feature of the Service that involves spoken input, you explicitly consent to the capture, transmission, and processing of audio recordings from your Device's microphone. Audio data collected through these features is subject to analysis by third-party artificial intelligence providers, as fully described in Section 3 of this Policy. Your grant of microphone access permission on your Device constitutes your affirmative consent to this collection and transmission. You may withdraw this consent at any time by revoking microphone permissions through your Device's operating system settings, provided that doing so will render voice-dependent features of the Service unavailable to you. We do not retain raw audio recordings on our own servers beyond the transient buffers required to transmit the data to the processing service and to receive the resulting analysis output; however, our third-party processing partners may store audio data in accordance with their own data retention schedules and policies, for which We bear no independent responsibility beyond the contractual obligations we have imposed on them."
        },
        {
          heading: "How We Use the Information We Collect",
          body: "The information described in the foregoing subsections is used by the Company for the following purposes, each of which constitutes a legitimate basis for processing under applicable data protection law: (a) to establish, maintain, authenticate, administer, and personalize your Account and to provide you with access to the features and functionalities of the Service that correspond to your account tier and authorization level; (b) to operate and deliver the core Service functionality, including the creation, storage, retrieval, editing, organization, and deletion of journal entries and associated media content; (c) to process your journal content and audio input through algorithmic and artificial intelligence analysis pipelines in order to generate emotional insights, sentiment analyses, thematic categorizations, trend identifications, personalized recommendations, and textual transcriptions as requested by you or enabled as default features of the Service; (d) to communicate with you by electronic mail or push notification for purposes including account registration confirmation, security alerts, password reset instructions, product update notifications, and service-related administrative communications; (e) to monitor, analyze, and evaluate patterns of usage across the Service user base in aggregate in order to diagnose technical faults, optimize performance, prioritize feature development, and measure the efficacy of product interventions; (f) to detect, investigate, and take action in response to fraudulent, abusive, unauthorized, or otherwise unlawful activity conducted through or directed at the Service; (g) to fulfill obligations imposed upon the Company by applicable law, court order, regulatory requirement, or binding legal process; and (h) to evaluate, negotiate, and consummate corporate transactions including mergers, acquisitions, asset sales, financings, or reorganizations in which user data constitutes a transferred asset, subject always to the notification obligations prescribed by applicable law."
        },
        {
          heading: "Circumstances in Which We Share Your Information",
          body: "The Company does not sell your Personal Data to third parties for their own independent marketing purposes. We may disclose or transfer Personal Data to other parties only in the following circumstances: to Service Providers and sub-processors who process data on our behalf under contractual obligations of confidentiality and data security that are no less protective than those set forth in this Policy, including the artificial intelligence processing partners identified in Section 3, the analytics providers identified in Section 4, and the infrastructure providers identified in Section 6; to other users of the Service when and to the extent that you have explicitly exercised the public sharing or journal publication feature of the Service, in which case the content of the shared entry becomes accessible to any person who obtains the corresponding share link; to prospective or actual acquirers, successors, investors, or partners in connection with any pending or completed corporate transaction, subject to binding obligations of confidentiality; to public authorities, law enforcement agencies, regulators, or courts where required or permitted by applicable law, court order, subpoena, or other binding legal process; and to any other third party where you have provided your express prior written or click-through consent specifically authorizing that disclosure."
        }
      ]
    },
    {
      id: 3,
      title: "Third-Party Artificial Intelligence and Machine Learning Service Providers",
      subsections: [
        {
          heading: "General Disclosure Regarding AI Processing",
          body: "The Service integrates and relies upon computational capabilities provided by multiple third-party artificial intelligence and machine learning platform operators in order to deliver its core analytical and generative features. As a structural consequence of this architecture, certain categories of your Personal Data â€” most significantly your Journal Content, conversation history submitted to the AI chatbot interface, and audio recordings captured through voice-enabled features â€” are transmitted over encrypted network connections to the servers of these external providers for processing. Each such provider operates as a data processor under a contractual arrangement with the Company that obligates them to process your data solely for the purposes specified by the Company, to implement appropriate technical and organizational security measures, and to refrain from using your data for any purpose other than as directed. Notwithstanding these contractual protections, each provider also operates under its own independently published privacy documentation which may extend rights and obligations beyond what this Policy describes. We represent that, as of the date indicated at the top of this Policy, we have not entered into any arrangement with any of the AI providers named herein that permits them to use your identifiable Personal Data to train their foundation models; however, the terms of such arrangements are subject to periodic renegotiation and the Company cannot make binding commitments regarding the future data use practices of independent third parties. You are strongly advised to avoid entering particularly sensitive personal information â€” including, but not limited to, financial account credentials, government-issued identification numbers, passwords, medical records, or information relating to minors â€” into any journal entry or conversational input, as such content will be transmitted to the AI platforms described below."
        },
        {
          heading: "Voice and Emotional Intelligence Processing",
          body: "For features involving voice journaling, spoken energy check-ins, and vocal emotion measurement, We transmit audio recordings captured from your Device's microphone to Hume AI, Inc. (accessible at hume.ai), a provider specializing in the computational analysis of human emotional expression. The processing performed by Hume AI on audio data submitted through Our Service encompasses but is not limited to prosodic feature extraction, spectral analysis of vocal characteristics, temporal and rhythmic pattern recognition, multi-dimensional emotional state inference across recognized affect dimensions such as valence, arousal, and discrete categorized emotional states, and the production of structured prediction outputs that the Company's application layer uses to populate features such as energy check-in readings, mood trend graphs, and personalized journaling prompts. The Company transmits audio data to Hume AI's processing endpoints over mutually authenticated TLS-encrypted connections. Your use of any voice-activated feature of the Service constitutes your informed consent to this transborder transmission and processing. Hume AI's data handling practices are governed by Hume AI's own published privacy documentation, which We encourage you to review independently."
        },
        {
          heading: "Automatic Speech Recognition and Transcription",
          body: "For the purpose of generating textual transcriptions of audio submissions, the Company transmits audio recordings to Deepgram, Inc. (accessible at deepgram.com), a provider of deep-learning-based automatic speech recognition services. Deepgram's processing systems receive audio files or streaming audio data and return textual representations of the spoken content, which the Company then stores in association with your Account and uses to populate journal entry transcripts and to enable downstream text-based analysis features. Deepgram operates as a data processor under our instructions and is contractually prohibited from using your audio data for any purpose inconsistent with providing transcription services to the Company. Deepgram's independent data governance practices are described in Deepgram's published privacy documentation."
        },
        {
          heading: "Large Language Model Processing for Journal Analysis and Conversational Features",
          body: "The Company utilizes large language model (LLM) application programming interfaces operated by multiple providers to power journal analysis, insight generation, thematic mapping, pattern identification, personalized recommendation, and AI-assisted conversational features. These providers include, as applicable depending on the feature engaged and the Company's current configuration: OpenAI, LLC (accessible at openai.com), whose models may process journal entry text, conversation history, and analytical queries submitted by or on behalf of users; Google LLC (accessible at ai.google.dev), whose Gemini family of generative models processes journal content for analytical and summarization tasks; and Anthropic PBC (accessible at anthropic.com), whose Claude language models power the conversational AI assistant interface within the Service. In each case, the Company transmits the minimum amount of content necessary to service the user's request; however, the processing of journal content by these models necessarily involves that content being accessible â€” for the duration of the machine learning inference computation â€” to the computational infrastructure operated by these providers. Users who do not wish their journal content to be processed by external model providers should refrain from activating AI-powered analysis features within the Service. The Company's agreements with each of these providers include data processing provisions binding each provider to process user data solely for the purpose of responding to Company API requests."
        }
      ]
    },
    {
      id: 4,
      title: "Analytics, Behavioral Measurement, and User-Journey Tracking",
      subsections: [
        {
          heading: "Product Analytics and Session Intelligence",
          body: "We use PostHog, Inc. (accessible at posthog.com), an open-core product analytics platform, to collect, aggregate, and analyze behavioral data about how individuals interact with the Service. PostHog's tracking instrumentation, which is embedded within the Service's client-side code and which is initialized upon your first interaction with a Service page, captures a comprehensive range of interaction signals including but not restricted to: each page view and screen view event, including the URL path accessed and the approximate local time of access; click events on interactive interface elements including buttons, navigation items, form submission actions, and links; feature activation events corresponding to the opening or use of specific Service capabilities; scroll-depth measurements indicating how far into a given page you scroll; session duration from first to last recorded event; user flow sequences describing the order in which you navigate between Service pages or features; and any custom event types that the Company has configured for measurement in connection with particular product features or experiments. Upon your authentication into your Account, PostHog's instrumentation may associate subsequent behavioral events with your internal user identifier, enabling the Company to analyze how specific users or user cohorts interact with features over time. PostHog may separately capture and store session replay recordings â€” pixel-accurate visual reproductions of your interaction session rendered from logged interaction events â€” which the Company's internal team may review for the purpose of diagnosing usability issues or understanding navigation patterns. Session replays are processed in a manner that applies automatic masking rules to input fields designated as sensitive, including password fields; however, the completeness of that masking coverage cannot be guaranteed for all dynamic content. You may limit PostHog's data collection by enabling tracking protection features in your web browser, installing content-blocking browser extensions, or requesting opt-out through the contact information provided at the conclusion of this Policy."
        },
        {
          heading: "Infrastructure Performance and Web Vitals Measurement",
          body: "We use Vercel Analytics, a service operated by Vercel, Inc. (accessible at vercel.com), to monitor the real-user performance characteristics of the Service's web delivery infrastructure. Vercel Analytics collects lightweight, aggregated telemetry signals including Core Web Vitals measurements â€” comprising Largest Contentful Paint, First Input Delay, Cumulative Layout Shift, and Time to First Byte â€” as well as page view counts, geographic distribution of user traffic aggregated to the country level, and device type classifications. Vercel Analytics is designed and represented by its operator to collect this information without associating it with individually identifiable user profiles or storing persistent user identifiers; accordingly, We treat data processed by Vercel Analytics as aggregated statistical information rather than as Personal Data. The Company uses these signals exclusively for the purpose of monitoring Service performance, diagnosing delivery bottlenecks, and prioritizing infrastructure optimization efforts."
        },
        {
          heading: "Marketing Attribution, Campaign Tracking, and Waitlist Analytics",
          body: "When you submit an entry to the Force waitlist, access the Service through a marketing landing page, or visit the Service following a click on an externally hosted advertisement or referral link, the Company may collect marketing attribution metadata associated with that visit or submission. This metadata includes UTM parameter values appended to the URL through which you accessed the Service â€” specifically the utm_source, utm_medium, utm_campaign, utm_content, and utm_term parameters, which encode information about the marketing channel, campaign, creative unit, or keyword that brought you to the Service â€” as well as the HTTP Referer header value identifying the webpage from which you navigated to the Service, the user agent string identifying your browser and operating system, and the approximate date and time of your visit. This information is stored in association with your waitlist submission record and is used by the Company's marketing and growth teams to evaluate the performance of specific acquisition channels and campaigns, to allocate marketing expenditure, and to identify which external sources produce the highest-quality user registrations. Waitlist attribution data is retained for the periods described in Section 5 of this Policy and is not used for any purpose other than internal marketing effectiveness analysis."
        }
      ]
    },
    {
      id: 5,
      title: "Retention, Deletion, and Anonymization of Personal Data",
      subsections: [
        {
          heading: "General Retention Principles",
          body: "The Company retains Personal Data only for as long as the retention of such data is necessary to fulfill the specific purpose for which it was collected, to satisfy applicable legal obligations, to resolve pending disputes, or to enforce contractual rights and obligations. Upon the expiration of the applicable retention period for a given category of data, the Company will either securely and irreversibly delete that data from its active systems or anonymize it such that it can no longer be attributed to any identified or identifiable individual. Where Personal Data exists in multiple forms or in multiple storage systems â€” including application databases, backup archives, audit logs, and analytics platforms â€” the applicable retention period applies to the active production copy of the data; residual copies that persist in encrypted backup media subject to scheduled rotation cycles may remain for a period of up to ninety (90) days beyond the active-system deletion event before being overwritten or destroyed in the ordinary course of the Company's backup lifecycle management procedures, during which time such residual copies are not accessed for any purpose other than disaster recovery."
        },
        {
          heading: "Retention Periods by Data Category",
          body: "Account and identity data, comprising your email address, name, username, profile attributes, and authentication credentials, is retained for the full duration of your active Account relationship and for a further period of twenty-four (24) months following the voluntary or involuntary closure or deactivation of your Account, in order to accommodate post-termination queries, dispute resolution proceedings, regulatory investigations, and the enforcement of contractual rights that may survive Account termination. Journal Content, including the text, mood data, energy readings, thematic classifications, and attached media files associated with your journal entries, is retained for the life of your Account and is scheduled for deletion within thirty (30) days following confirmed Account deletion, subject to any applicable legal hold or dispute-related preservation obligation. Audio recordings submitted through voice-enabled features are transmitted to third-party processing services for real-time analysis and are not retained by the Company on its own persistent storage infrastructure beyond the transient network transmission buffers; however, audio processing logs and the structured outputs derived from audio analysis â€” such as emotional valence scores and transcription text â€” are retained as part of your Journal Content for the period described in the preceding sentence. Customer support communications, including electronic mail correspondence, support ticket content, and chat transcripts exchanged with the Company's support personnel, are retained for a period of twenty-four (24) months from the date of resolution of the underlying support issue, in order to facilitate follow-on inquiries, to support quality assurance review, and to defend against claims asserting the inadequacy of support services rendered. Usage Data, including application interaction logs, session records, and server-level access logs capturing Internet Protocol addresses and access timestamps, is retained for a maximum period of twenty-four (24) months from the date of generation, for purposes of security monitoring, anomaly detection, abuse investigation, and infrastructure capacity planning. Analytics data processed by PostHog and retained within the PostHog platform is governed by the retention settings configured by the Company within the PostHog administration console, which at present are set to a maximum retention horizon of twenty-four (24) months, subject to PostHog's own data lifecycle management practices. Marketing attribution data associated with waitlist submissions is retained for a period of thirty-six (36) months from collection, after which it is aggregated and anonymized."
        },
        {
          heading: "Deletion and Anonymization Procedures",
          body: "Upon expiration of the applicable retention period, or upon your submission of a verified deletion request as described in Section 8 of this Policy, Personal Data is subjected to one of the following disposition procedures as determined by the Company in its reasonable discretion based on the nature of the data and the storage medium involved. Deletion refers to the irreversible removal of Personal Data from the Company's active production databases and file storage systems such that it is no longer accessible to any application process, user interface, or administrative query. Where deletion of Personal Data from production systems would be technically impractical due to the data's presence within structured analytical aggregates, cached computations, or de-identified statistical summaries that do not permit individual-record extraction, the Company instead applies anonymization â€” a process by which all direct and indirect identifiers linking the data to a specific individual are removed or generalized such that re-identification is not reasonably practicable through any means likely to be used, after which the resulting anonymized statistical data may be retained indefinitely for product development and research purposes. The Company does not warrant that deletion of Personal Data from its active systems will simultaneously trigger deletion from systems operated by third-party Service Providers, who are each solely responsible for the implementation of their own data lifecycle procedures pursuant to their respective agreements with the Company."
        }
      ]
    },
    {
      id: 6,
      title: "International Data Transfers and Cross-Border Processing",
      subsections: [
        {
          heading: "Nature and Scope of International Transfers",
          body: "As a consequence of the Company's reliance on cloud-based infrastructure and third-party processing services whose computing infrastructure is geographically distributed, Personal Data submitted through or generated in connection with the Service may be transferred to, stored on, and processed by servers and data centers located in countries outside of India â€” the country in which the Company is incorporated and primarily operates â€” and outside the country in which you are ordinarily resident. Such transfers occur as an ordinary and necessary consequence of delivering the Service to a globally distributed user base and of engaging the artificial intelligence, analytics, and infrastructure service providers described in Sections 3, 4, and the database storage disclosures within Section 6, respectively, whose primary computing infrastructure is located principally in the United States. The data protection and privacy laws applicable to processing activities conducted in those jurisdictions may be materially different from â€” and in some respects less protective than â€” the laws of India or of the jurisdiction in which you reside."
        },
        {
          heading: "Safeguards and Legal Mechanisms",
          body: "To the extent required by applicable data protection legislation, the Company takes measures reasonably designed to ensure that transfers of Personal Data to third countries are conducted in accordance with a recognized legal transfer mechanism or with the benefit of appropriate supplementary safeguards. These measures may include, as applicable: entering into data processing agreements with third-party Service Providers that incorporate standard contractual clauses or equivalent contractual protections; relying on provider certifications or accountability frameworks as evidence of adequate technical and organizational data protection measures; and implementing end-to-end encryption of Personal Data prior to transmission so as to limit the ability of processors operating in third countries to access plaintext user content. Notwithstanding the foregoing, the Company cannot guarantee that the legal framework of any particular country to which data is transferred will at all times afford a standard of protection equivalent to that of the jurisdiction from which data originates, and you acknowledge this inherent limitation by your continued use of the Service."
        }
      ]
    },
    {
      id: 7,
      title: "Data Storage Infrastructure and Security Architecture",
      subsections: [
        {
          heading: "Primary Data Storage Platform",
          body: "The Company's primary relational database and object storage services are provided by Supabase, Inc. (accessible at supabase.com), a cloud data platform that operates on PostgreSQL-compatible infrastructure hosted predominantly on computing infrastructure provided by Amazon Web Services in data center regions located in the United States. All Account data, Journal Content, user-generated media files, application configuration data, and relational metadata associated with the Service's core functionality is persisted in Supabase-managed storage systems. Supabase's role in relation to this data is that of a data processor operating under binding contractual instructions from the Company that specify the permissible purposes for processing, impose obligations of confidentiality, and require the implementation of technical and organizational security measures commensurate with the sensitivity of the data processed. The Company's engagement of Supabase as a processing platform does not diminish the Company's accountability to you as the data controller ultimately responsible for determining the purposes and means of processing your Personal Data."
        },
        {
          heading: "Encryption and Application-Level Data Protection",
          body: "The Company implements a multi-layered data protection architecture designed to limit the exposure of your Journal Content in the event of unauthorized access to storage infrastructure. Specifically, Journal entry text, titles, mood indicators, and classification data are subjected to symmetric encryption using the Advanced Encryption Standard in Cipher Block Chaining mode with a 256-bit key length (AES-256-CBC) at the application layer, prior to and independent of any encryption that may be applied at the database or storage platform level. This means that the ciphertext stored in the database is not decryptable by parties that access the database directly without also possessing the application-level encryption key. Media files â€” comprising photographic images, video recordings, and audio recordings â€” uploaded to the Service are stored in Supabase Storage buckets configured with access control policies that restrict retrieval to authenticated requests associated with the Account to which the files belong or to authorized server-side processing pipelines. All communication between your Device and the Company's servers, and between the Company's servers and third-party Service Providers, is conducted exclusively over Transport Layer Security (TLS) encrypted connections. Notwithstanding these measures, the Company does not represent or warrant that your Personal Data is immune from unauthorized access, and no security architecture can provide absolute protection against all classes of security threat."
        },
        {
          heading: "Public Content and Journal Sharing",
          body: "The default access configuration for all journal entries created within the Service is private, meaning that the content of your entries is accessible solely to your authenticated Account session and to the Company's authorized data processing systems. You may, at your election, activate the public sharing feature for any individual journal entry, which causes the Company to generate a unique, pseudorandom share link associated with that entry and to configure the corresponding access permissions to permit unauthenticated read access to that entry's content by any person who possesses or acquires the share link. Once a shared entry has been accessed via its share link, the Company has no technical means of recalling or erasing copies of that content that may have been captured, downloaded, cached, or further disseminated by third parties prior to your revocation of the share link. You understand and accept this irrevocability with respect to any content you have shared. You may revoke the public accessibility of any shared entry at any time through the sharing management interface within the Service, which will disable the share link and reinstate private access controls; however, such revocation operates only prospectively and does not affect any copies already made by third parties."
        }
      ]
    },
    {
      id: 8,
      title: "Your Rights Regarding Your Personal Data",
      subsections: [
        {
          heading: "Right to Access, Correction, and Portability",
          body: "Subject to applicable law and to reasonable identity verification requirements, you have the right to request from the Company a confirmation of whether Personal Data relating to you is being processed, and where that is the case, to receive a copy of that Personal Data in a structured, commonly used, and machine-readable format. You also have the right to request the correction or rectification of Personal Data relating to you that is inaccurate, incomplete, or outdated. Within the Service's account settings interface, you may directly access and modify the majority of Personal Data associated with your Account, including your profile information and account credentials. For categories of Personal Data not directly editable through the self-service interface, you may submit a correction request to the Company using the contact information set forth at the conclusion of this Policy."
        },
        {
          heading: "Right to Erasure and Account Deletion",
          body: "You have the right to request the deletion or erasure of Personal Data relating to you, subject to the Company's obligation to retain certain categories of data for purposes of legal compliance, dispute resolution, or enforcement of contractual rights that survive Account termination as more fully described in Section 5 of this Policy. You may initiate the deletion of specific Journal Content, media files, and Account-level data through the deletion interfaces provided within the Service â€” including the ability to delete individual journal entries, to remove connected integrations such as Google Calendar, and to permanently close your Account. A request for complete Account deletion may be submitted through the account settings interface or by contacting the Company at the address provided below. Upon receipt and verification of an Account deletion request, the Company will schedule your Account and its associated Personal Data for deletion within the timeframes described in Section 5. You acknowledge that the exercise of your deletion right does not obligate the Company to delete data that We are required by applicable law or legally binding obligation to retain, and does not extend to anonymized statistical data derived from your Personal Data that is maintained indefinitely."
        },
        {
          heading: "Right to Object and Restriction of Processing",
          body: "To the extent permitted by applicable law, you may have the right to object to the processing of your Personal Data on grounds relating to your particular situation, including where processing is conducted on the basis of legitimate interests pursued by the Company or a third party. You may also request the restriction of processing of your Personal Data in specified circumstances, including where you contest the accuracy of the data while the Company is taking steps to verify it, where processing is unlawful but you prefer restriction to deletion, or where the Company no longer requires the data for the original purpose but you require it to be retained for the establishment, exercise, or defense of legal claims. To exercise any of these rights, you may contact the Company using the contact information provided at the conclusion of this Policy. The Company will respond to substantiated rights requests within the timeframes required by applicable law, and in no event later than thirty (30) days from receipt of a complete and verifiable request, subject to any extensions permitted by applicable law."
        }
      ]
    },
    {
      id: 9,
      title: "Disclosure in Legal and Corporate Contexts",
      subsections: [
        {
          heading: "Corporate Transactions",
          body: "In the event that the Company enters into negotiations for, or consummates, a merger, acquisition, consolidation, restructuring, asset sale, financing transaction, change of control, or other corporate transaction involving all or a material portion of its business or assets, Personal Data held by the Company may constitute a transferred asset that is disclosed to, evaluated by, or migrated to the counterparty or successor entity involved in such transaction. In the event that such a transaction results in Personal Data becoming subject to a privacy policy materially different from this one, the Company will provide affected users with advance notice of such change by posting a prominent notice on the Service or by transmitting a notification to the email address associated with each affected Account, and will afford users a reasonable opportunity to exercise any deletion rights they may hold prior to the effective date of the change."
        },
        {
          heading: "Disclosures Required by Law",
          body: "The Company may be obligated to disclose Personal Data to governmental bodies, law enforcement agencies, regulatory authorities, courts of competent jurisdiction, or other public authorities pursuant to duly issued court orders, subpoenas, warrants, regulatory demands, or other binding legal processes. In such cases, the Company will disclose no more Personal Data than is required by the applicable legal process and will endeavor, to the extent permitted by applicable law and the terms of the legal process, to notify affected users of the disclosure request unless such notification is expressly prohibited by the terms of the legal process or by applicable law. The Company reserves the right to disclose Personal Data without prior notice and without the benefit of a formal legal process where the Company, in its reasonable judgment, believes in good faith that such disclosure is urgently necessary to prevent or mitigate imminent physical harm to a person, to protect the integrity and availability of the Service and its infrastructure, to investigate or halt ongoing fraudulent or abusive activity, or to assert or defend the Company's legal rights in litigation or regulatory proceedings."
        }
      ]
    },
    {
      id: 10,
      title: "Security of Personal Data",
      subsections: [
        {
          heading: "Security Measures Implemented",
          body: "The Company has implemented, and continues to maintain and periodically review, a comprehensive set of technical and organizational security measures designed to protect Personal Data against unauthorized or unlawful access, acquisition, use, disclosure, alteration, destruction, or loss. These measures include, but are not limited to: application-layer encryption of journal content using AES-256-CBC prior to database persistence; mandatory TLS encryption for all data in transit between client devices and Company servers and between Company servers and third-party processing services; access control policies limiting the ability to retrieve plaintext user data to authenticated account sessions and to authorized server-side computational processes; role-based administrative access controls limiting employee and contractor access to production user data to those with a demonstrated operational need; regular review and updating of security configurations in response to emerging threats and vulnerabilities; and contractual security obligations imposed on all Service Providers that process Personal Data on the Company's behalf."
        },
        {
          heading: "Limitations of Security Guarantees",
          body: "Notwithstanding the foregoing security measures, no information security architecture is capable of providing an absolute guarantee against all forms of unauthorized access, cyberattack, data breach, or system compromise. The Company does not represent or warrant that Personal Data stored or processed in connection with the Service is immune from security incidents of any kind. In the event that the Company becomes aware of a security incident that is reasonably likely to result in a high risk to the rights and freedoms of affected users, the Company will notify affected users in the manner required by applicable law and will take steps to contain and remediate the incident as expeditiously as practicable. The Company's liability in connection with any security incident is subject to the limitations of liability prescribed by the Terms and Conditions and applicable law."
        }
      ]
    },
    {
      id: 11,
      title: "Children and Age Restrictions",
      subsections: [
        {
          heading: "Minimum Age Requirement and Protective Measures",
          body: "The Service is not directed to, and is not intended for use by, individuals under the age of sixteen (16) years. The Company does not knowingly solicit, collect, or retain Personal Data from individuals under the age of sixteen (16). If you are the parent or legal guardian of a minor under the age of sixteen (16) and you have reason to believe that your child has submitted Personal Data to the Service without your knowledge or consent, you should contact the Company immediately at the address provided below so that We may take prompt steps to identify and delete the data in question. If the Company independently discovers that it has collected Personal Data from an individual who was under the age of sixteen (16) at the time of collection and for whom the Company did not obtain valid parental consent at the time required, the Company will delete that data from its active systems including in the applicable retention schedule as expeditiously as technically practicable. The Company relies on representations made by users at the time of account registration â€” including any age verification mechanism incorporated into the registration flow â€” as the primary means of enforcing this restriction, and acknowledges that it does not independently verify the age of each user."
        }
      ]
    },
    {
      id: 12,
      title: "Third-Party Links and External Services",
      subsections: [
        {
          heading: "No Responsibility for External Privacy Practices",
          body: "The Service may, from time to time, contain hyperlinks, embedded content, or integration points that direct you to or connect with websites, applications, or services operated by parties other than the Company. The inclusion of any such link, embedded content, or integration does not constitute an endorsement, recommendation, or approval by the Company of the linked or connected resource or of its operator's privacy or data handling practices. The Company exercises no control over, and assumes no responsibility or liability for, the content, privacy policies, data collection practices, or security measures of any third-party website, application, or service that you access through links or integration points within the Service. Once you navigate away from the Service to a third-party resource, this Policy no longer governs the handling of your information, and the privacy policy of the third-party resource â€” if any â€” applies in its place. You are encouraged to review the privacy policies of any third-party services you access in connection with your use of the Service, and to exercise appropriate caution in sharing Personal Data with any external resource."
        }
      ]
    },
    {
      id: 13,
      title: "Modifications to this Privacy Policy",
      subsections: [
        {
          heading: "Right to Amend and Notification of Material Changes",
          body: "The Company reserves the right to unilaterally modify, amend, supplement, or completely replace this Policy at any time and for any reason, including but not limited to changes in applicable law, changes in the Company's data processing practices, the introduction of new Service features that involve the collection or use of Personal Data not previously described herein, or changes in the Company's relationships with third-party Service Providers. When the Company makes material changes to this Policy â€” meaning changes that substantively affect the nature of the Personal Data collected, the purposes for which it is used, the categories of third parties to whom it is disclosed, or the rights available to users â€” the Company will provide advance notice of such changes by posting a revised version of this Policy to this page with an updated \"Last updated\" date prominently displayed at the top, and by transmitting a notification to the email address associated with your Account or by displaying a prominent in-application notice, in either case prior to the effective date of the changes. For non-material changes â€” such as corrections of typographical errors, clarifications of existing descriptions, or updates to contact information â€” the Company may update this Policy without prior notice, and the revised version will be effective immediately upon posting. Your continued use of the Service following the effective date of any modification to this Policy constitutes your acceptance of that modification and your agreement to be bound by the Policy as modified. If you do not agree to a modification, your sole recourse is to cease using the Service and to request deletion of your Account and associated data in accordance with Section 8 of this Policy."
        }
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-linear-to-br from-emerald-50 via-teal-50 to-green-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-emerald-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="text-base font-semibold text-gray-900">Force</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Title */}
        <div className="mb-10 border-b border-emerald-200 pb-8">
          <h2 className="text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h2>
          <p className="text-sm text-gray-500">Last updated: March 11, 2026</p>
          <p className="mt-5 text-sm text-gray-600 leading-relaxed">
            This Privacy Policy (this &quot;Policy&quot;) is a binding legal instrument between you and Force LLC. It sets
            forth the terms and conditions under which the Company collects, retains, uses, discloses, and otherwise
            processes information relating to users of the Force application and associated services.  Please read this
            Policy carefully and in its entirety before using the Service. If any provision of this Policy is
            unacceptable to you, you must not use the Service.
          </p>
        </div>

        {/* Sections rendered as dense legal prose */}
        <div className="space-y-10">
          {sections.map((section, index) => (
            <section key={section.id} id={`section-${section.id}`} className="scroll-mt-24">
              <h3 className="text-lg font-bold text-gray-900 mb-5 uppercase tracking-wide">
                {index + 1}.&nbsp; {section.title}
              </h3>
              <div className="space-y-6">
                {section.subsections.map((sub, si) => (
                  <div key={si}>
                    <h4 className="text-sm font-semibold text-gray-800 mb-2 uppercase tracking-wide">
                      {index + 1}.{si + 1}&nbsp; {sub.heading}
                    </h4>
                    <p className="text-sm text-gray-600 leading-[1.85] text-justify hyphens-auto">
                      {sub.body}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Contact */}
        <div className="mt-14 pt-8 border-t border-emerald-200">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Contact Information</h3>
          <p className="text-sm text-gray-600 leading-relaxed mb-2">
            All inquiries, requests, or correspondence regarding this Policy, the exercise of data subject rights, or
            any matter relating to the Company&apos;s processing of Personal Data should be directed to:
          </p>
          <p className="text-sm text-gray-700 font-medium">Force LLC</p>
          <p className="text-sm text-gray-600">BD 37 Block 1 Natural Green, Kolkata 700101, West Bengal, India</p>
          <a href="mailto:work@findmyforce.com" className="text-sm text-emerald-700 hover:text-emerald-800 font-medium mt-1 inline-block">
            work@findmyforce.com
          </a>
        </div>

        {/* Acknowledgment */}
        <div className="mt-10 pt-8 border-t border-emerald-200">
          <p className="text-xs text-gray-500 leading-relaxed text-justify">
            BY ACCESSING OR USING THE SERVICE IN ANY MANNER, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE
            TO BE LEGALLY BOUND BY THIS PRIVACY POLICY IN ITS ENTIRETY, INCLUDING ALL SECTIONS HEREOF, AS AMENDED FROM
            TIME TO TIME IN ACCORDANCE WITH THE MODIFICATION PROCEDURES DESCRIBED IN SECTION 13. IF YOU ARE ACCESSING
            THE SERVICE ON BEHALF OF AN ORGANIZATION OR LEGAL ENTITY, YOU REPRESENT AND WARRANT THAT YOU HAVE THE
            AUTHORITY TO BIND THAT ENTITY TO THIS POLICY.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-emerald-200 mt-16 bg-white/60 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col items-center space-y-4">
            <Logo />
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <a
                href="https://www.findmyforce.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-emerald-600 transition-colors"
              >
                Home
              </a>
              <Link href="/terms-and-conditions" className="hover:text-emerald-600 transition-colors">
                Terms
              </Link>
              <Link href="/privacy-policy" className="hover:text-emerald-600 transition-colors">
                Privacy Policy
              </Link>
            </div>
            <p className="text-sm text-gray-400">Â© 2026 Force LLC. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
