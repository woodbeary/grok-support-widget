import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <Image
            className="mx-auto h-12 w-auto dark:invert"
            src="/next.svg"
            alt="Site Logo"
            width={100}
            height={48}
            priority
          />
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            Welcome to Mock Site
          </h1>
          <p className="mt-6 max-w-3xl mx-auto text-xl text-gray-500">
            This is a demo site to test the embeddable chat widget. Click the bubble in the bottom right to open the support chat.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Sample content */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold">Feature 1</h2>
            <p className="mt-2 text-gray-600">Description of feature.</p>
          </div>
          {/* More cards */}
        </div>
      </main>

      {/* Optional target div, but script creates it */}
      <div id="x-support-widget" className="fixed bottom-4 right-4 w-96 h-[500px] hidden border shadow-xl rounded-lg bg-white z-40" />

      {/* Embed the widget script */}
      <script
        src="http://localhost:3001/widget.js"
        data-customer-id="demo-customer"
        data-theme="light"
        async
      ></script>
    </div>
  );
}

