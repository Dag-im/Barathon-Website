"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Arial, sans-serif", background: "#F8F9FA", color: "#111827", margin: 0 }}>
        <main style={{ maxWidth: 640, margin: "0 auto", padding: "96px 16px" }}>
          <h1 style={{ fontSize: 34, margin: 0 }}>Something went wrong</h1>
          <p style={{ color: "#4B5563" }}>The site could not be displayed. Please try again.</p>
          <button type="button" onClick={() => reset()} style={{ height: 44, padding: "0 20px", background: "#2F447D", color: "#fff", border: 0, borderRadius: 4 }}>Try again</button>
        </main>
      </body>
    </html>
  );
}
