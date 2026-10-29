"use client"
import React from "react"
import { FileText, Calendar, Mail, Scale, Shield, AlertCircle } from "lucide-react"
import { motion } from "framer-motion"

interface Subsection {
  title: string
  content: string
}

interface Section {
  id: number
  title: string
  content?: string
  subsections?: Subsection[]
  icon?: React.ReactNode
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

export default function TermsAndConditions() {
  const sections: Section[] = [
    {
      id: 1,
      title: "Acceptance of Terms",
      icon: <FileText className="w-5 h-5" />,
      content: "By downloading, installing, accessing, or using Force (the \"Service\"), you agree to be bound by these Terms and Conditions (\"Terms\"). If you do not agree to these Terms, please do not use the Service."
    },
    {
      id: 2,
      title: "Definitions",
      icon: <Scale className="w-5 h-5" />,
      content: `"Content" refers to any text, images, audio recordings, videos, journal entries, or other material posted, shared, uploaded, or transmitted through the Service.\n\n"User" refers to any individual who accesses or uses the Service.\n\n"Force," "we," "us," or "our" refers to Force and its parent company, subsidiaries, and affiliates.`
    },
    {
      id: 3,
      title: "License Grant",
      icon: <Shield className="w-5 h-5" />,
      content: "Subject to your compliance with these Terms, Force grants you a limited, non-exclusive, non-transferable, revocable license to use the Service for personal development and growth purposes."
    },
    {
      id: 4,
      title: "User Accounts",
      subsections: [
        {
          title: "Registration",
          content: "You must provide accurate, current, and complete information when creating an account. You agree to update your information as necessary to maintain its accuracy."
        },
        {
          title: "Account Security",
          content: "You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account."
        },
        {
          title: "Age Restriction",
          content: "You must be at least 18 years of age to use the Service. By using the Service, you represent and warrant that you are 18 years of age or older."
        }
      ]
    },
    {
      id: 5,
      title: "Privacy and Data Collection",
      subsections: [
        {
          title: "Privacy Policy",
          content: "Your use of the Service is subject to our Privacy Policy, which is incorporated by reference into these Terms. Please review our Privacy Policy carefully for information relating to our collection, use, storage, and disclosure of your personal information."
        },
        {
          title: "Data Encryption",
          content: "We implement AES-256-CBC encryption to protect your journal data, including journal titles, content, mood indicators, and classifications. The encryption occurs at the application level before data is stored in our database."
        },
        {
          title: "Consent to Data Processing",
          content: "By using the Service, you consent to the collection, processing, and storage of your data as described in these Terms and our Privacy Policy. This includes text and audio inputs, journal entries, profile information, energy check-in data, and uploaded content."
        },
        {
          title: "Data Usage for Service Improvement",
          content: "You grant Force permission to use your anonymized and aggregated data to improve our algorithms, enhance the Service, and develop new features. We will never share your personally identifiable information with third parties without your explicit consent."
        }
      ]
    },
    {
      id: 6,
      title: "User Content and Rights",
      subsections: [
        {
          title: "Your Content",
          content: "You retain ownership of all Content you create, upload, or share on the Service. By providing Content to the Service, you grant Force a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, adapt, create derivative works from, and analyze your Content for the purposes of providing and improving the Service, generating personalized insights, and training our AI systems."
        },
        {
          title: "Content Restrictions",
          content: "You agree not to upload, share, or transmit any Content that is illegal, harmful, threatening, abusive, harassing, defamatory, invasive of privacy, infringes on intellectual property rights, contains malware, promotes violence or discrimination, or impersonates another person or entity."
        },
        {
          title: "Removal Rights",
          content: "Force reserves the right to remove any Content that violates these Terms or is otherwise objectionable, without prior notice."
        }
      ]
    },
    {
      id: 7,
      title: "Service Functionality",
      subsections: [
        {
          title: "AI Analysis",
          content: "The Service uses artificial intelligence to analyze your inputs, including text, audio, images, and videos, to provide insights and personalized recommendations. While we strive for accuracy, you acknowledge that our AI analysis may not always be perfect."
        },
        {
          title: "OCR and Document Processing",
          content: "The Service may include optical character recognition (OCR) functionality to digitize and analyze uploaded physical journal entries. Force does not guarantee complete accuracy of OCR processing."
        },
        {
          title: "Energy Check-In",
          content: "The Service may include features for emotional and energy state assessment based on voice patterns and text inputs. These assessments are for personal reference only and are not intended to substitute for professional mental health evaluation."
        }
      ]
    },
    {
      id: 8,
      title: "Termination",
      subsections: [
        {
          title: "By Users",
          content: "You may terminate your account at any time by following the instructions on the Service or by contacting our support team."
        },
        {
          title: "By Force",
          content: "Force may suspend or terminate your account for any violation of these Terms or for any other reason at our discretion. We will make reasonable efforts to notify you of any termination."
        },
        {
          title: "Effect of Termination",
          content: "Upon termination, your right to use the Service will immediately cease. Force may, but is not obligated to, delete your account data upon termination."
        }
      ]
    },
    {
      id: 9,
      title: "Disclaimers and Limitations",
      icon: <AlertCircle className="w-5 h-5" />,
      subsections: [
        {
          title: "Warranty Disclaimer",
          content: "THE SERVICE IS PROVIDED \"AS IS\" AND \"AS AVAILABLE\" WITHOUT ANY WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED. FORCE DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE."
        },
        {
          title: "Not a Substitute for Professional Help",
          content: "THE SERVICE IS NOT INTENDED TO REPLACE PROFESSIONAL MEDICAL, MENTAL HEALTH, OR THERAPEUTIC ADVICE. IF YOU ARE EXPERIENCING MENTAL HEALTH ISSUES, PLEASE CONSULT WITH A QUALIFIED HEALTHCARE PROFESSIONAL."
        },
        {
          title: "Limitation of Liability",
          content: "TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, FORCE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY."
        }
      ]
    },
    {
      id: 10,
      title: "Modifications to Service and Terms",
      content: "Force reserves the right to modify or discontinue the Service, temporarily or permanently, at any time, with or without notice. We may also modify these Terms from time to time. We will notify you of material changes to these Terms by posting a notice on our website or through the Service. Your continued use of the Service after such notification constitutes your acceptance of the modified Terms."
    },
    {
      id: 11,
      title: "Governing Law",
      content: "These Terms shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law provisions. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts located in India."
    },
    {
      id: 12,
      title: "Indemnification",
      content: "You agree to indemnify and hold harmless Force and its officers, directors, employees, and agents from any claims, liabilities, damages, losses, costs, or expenses arising from your use of the Service or violation of these Terms."
    },
    {
      id: 13,
      title: "Intellectual Property",
      content: "All intellectual property rights in the Service, including but not limited to software, features, graphics, and content created by Force, are owned by Force or its licensors. Nothing in these Terms grants you any right to use Force's intellectual property without our prior written consent."
    },
    {
      id: 14,
      title: "Severability",
      content: "If any provision of these Terms is found to be unenforceable or invalid, that provision will be limited or eliminated to the minimum extent necessary so that these Terms will otherwise remain in full force and effect."
    },
    {
      id: 15,
      title: "Entire Agreement",
      content: "These Terms constitute the entire agreement between you and Force regarding the use of the Service, superseding any prior agreements between you and Force relating to your use of the Service."
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-emerald-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo />
              <h1 className="text-base font-semibold text-gray-900">Force</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title Section */}
        <div className="mb-8">
          <h2 className="text-4xl font-bold text-gray-900 mb-3">
            Terms and Conditions
          </h2>
          <p className="text-base text-gray-500">
            Last updated: December 24, 2025
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {sections.map((section, index) => (
            <section
              key={section.id}
              id={`section-${section.id}`}
              className="scroll-mt-24"
            >
              {/* Section Header */}
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                {index + 1}. {section.title}
              </h3>

              {/* Section Content */}
              <div className="space-y-4">
                {section.content && (
                  <p className="text-base text-gray-600 leading-relaxed whitespace-pre-line">
                    {section.content}
                  </p>
                )}
                
                {section.subsections && (
                  <div className="space-y-4">
                    {section.subsections.map((subsection, subIndex) => (
                      <div key={subIndex}>
                        <h4 className="text-base font-semibold text-gray-900 mb-2">
                          {index + 1}.{subIndex + 1} {subsection.title}
                        </h4>
                        <p className="text-base text-gray-600 leading-relaxed">
                          {subsection.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>

        {/* Contact Section */}
        <div className="mt-12 pt-8 border-t border-emerald-200">
          <h3 className="text-base font-semibold text-gray-900 mb-3">
            Contact Information
          </h3>
          <p className="text-sm text-gray-600 mb-3 leading-relaxed">
            For questions about these Terms, or to report violations, please contact us at:
          </p>
          <a
            href="mailto:work@findmyforce.com"
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
          >
            work@findmyforce.com
          </a>
        </div>

        {/* Acknowledgment */}
        <div className="mt-12 pt-8 border-t border-emerald-200">
          <p className="text-base text-gray-600 leading-relaxed">
            By using Force, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-emerald-200 mt-16 bg-white/60 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col items-center space-y-4">
            <Logo />
            <div className="flex items-center gap-6 text-base text-gray-500">
              <a href="https://www.findmyforce.com/" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-600 transition-colors">
                Home
              </a>
              <a href="/terms-and-conditions" className="hover:text-emerald-600 transition-colors">
                Terms
              </a>
              <a href="/privacy-policy" className="hover:text-emerald-600 transition-colors">
                Privacy Policy
              </a>
            </div>
            <p className="text-base text-gray-400">
              © 2026 Force. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}