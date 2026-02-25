export const metadata = {
  title: 'Privacy Policy – Daysweeper',
  description: 'Privacy policy for the Daysweeper and LastLeg applications.'
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-sm leading-relaxed text-foreground">
      <h1 className="mb-2 text-3xl font-bold">Privacy Policy</h1>
      <p className="mb-8 text-muted-foreground">Last updated: February 25, 2026</p>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">1. Overview</h2>
        <p>
          Daysweeper and the LastLeg mobile application (&quot;we&quot;, &quot;our&quot;, or &quot;the App&quot;) are
          operated by APR. This Privacy Policy explains what information we collect, how we use it, and
          your rights regarding that information.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">2. Information We Collect</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Account information:</strong> email address and name provided when you sign in.
          </li>
          <li>
            <strong>Location data:</strong> addresses and geographic coordinates you enter or look up
            while planning routes. We do not collect your device&apos;s real-time GPS location in the
            background.
          </li>
          <li>
            <strong>Usage data:</strong> pages visited, features used, and error logs to help us
            improve the App.
          </li>
          <li>
            <strong>Route data:</strong> stops, routes, and notes you create within the App.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">3. How We Use Your Information</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>To provide and operate the App and its features.</li>
          <li>To save and sync your routes and company data across devices.</li>
          <li>To improve performance, fix bugs, and develop new features.</li>
          <li>To communicate important updates about the App.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">4. Sharing of Information</h2>
        <p>
          We do not sell your personal information. We may share data with trusted third-party service
          providers (e.g., hosting, authentication, mapping) solely to operate the App. These providers
          are contractually required to protect your data and may not use it for other purposes.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">5. Data Retention</h2>
        <p>
          We retain your data for as long as your account is active or as needed to provide the
          service. You may request deletion of your account and associated data at any time by
          contacting us.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">6. Security</h2>
        <p>
          We use industry-standard encryption (TLS/HTTPS) to protect data in transit and store data on
          secured servers. No method of transmission over the internet is 100% secure, but we take
          reasonable steps to protect your information.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">7. Children&apos;s Privacy</h2>
        <p>
          The App is not directed to children under 13. We do not knowingly collect personal
          information from children under 13. If you believe we have inadvertently collected such
          information, please contact us and we will delete it promptly.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">8. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of significant
          changes by updating the date at the top of this page. Continued use of the App after changes
          constitutes acceptance of the updated policy.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">9. Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy or your data, please contact us at{' '}
          <a href="mailto:privacy@apr.com" className="text-primary underline">
            privacy@apr.com
          </a>
          .
        </p>
      </section>
    </main>
  );
}
