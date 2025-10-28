import { Card } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </div>
        <Card className="prose prose-gray mx-auto max-w-4xl dark:prose-invert">
          <h1 className="text-foreground">Terms of Service</h1>
          <p className="text-muted-foreground">Last updated: July 29, 2024</p>

          <p>
            Welcome to Saga! These Terms of Service ("Terms") govern your use of
            the Saga website, applications, and services (collectively, the
            "Services"). By using our Services, you agree to be bound by these
            Terms.
          </p>

          <h2>1. Your Account</h2>
          <p>
            You may need to create an account to use some of our Services. You
            are responsible for safeguarding your account and for all activities
            that occur under your account.
          </p>

          <h2>2. Privacy</h2>
          <p>
            Our Privacy Policy describes how we handle the information you
            provide to us when you use our Services. You understand that through
            your use of the Services you consent to the collection and use of
            this information.
          </p>

          <h2>3. Content on the Services</h2>
          <p>
            You are responsible for your use of the Services and for any content
            you provide, including compliance with applicable laws, rules, and
            regulations.
          </p>

          <h2>4. Prohibited Uses</h2>
          <p>
            You may not use the Services to post or transmit any content that is
            unlawful, threatening, abusive, libelous, defamatory, obscene,
            vulgar, pornographic, profane, or indecent.
          </p>

          <h2>5. Limitation of Liability</h2>
          <p>
            In no event shall Saga, its directors, employees, or agents be
            liable for any indirect, incidental, special, consequential or
            punitive damages, including without limitation, loss of profits,

            data, use, goodwill, or other intangible losses.
          </p>

          <h2>6. Changes to These Terms</h2>
          <p>
            We may revise these Terms from time to time. The most current
            version will always be on this page. By continuing to access or use
            the Services after those revisions become effective, you agree to be
            bound by the revised Terms.
          </p>

          <h2>7. Contact Us</h2>
          <p>
            If you have any questions about these Terms, please contact us at{' '}
            <a href="mailto:support@saga.com">support@saga.com</a>.
          </p>
        </Card>
      </div>
    </div>
  )
}
