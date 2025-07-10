import { SignIn, SignedIn, SignedOut } from "@clerk/clerk-react";

export function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md">
        <SignedOut>
          <SignIn />
        </SignedOut>
        <SignedIn>
          {/* Optionally, you can show a welcome message or redirect here */}
        </SignedIn>
      </div>
    </div>
  );
}
