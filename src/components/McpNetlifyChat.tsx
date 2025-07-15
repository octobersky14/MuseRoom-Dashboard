import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';

const McpNetlifyChat: React.FC = () => {
  const [message, setMessage] = useState<string>('');
  const [response, setResponse] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      // Call the Netlify function with the message
      const result = await fetch('/.netlify/functions/mcp-chat-fixed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      if (!result.ok) {
        const errorData = await result.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${result.status}`);
      }

      const data = await result.json();
      setResponse(data.response || 'No response received');
    } catch (err) {
      console.error('Error calling MCP chat function:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setResponse('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl font-bold">MCP Chat Test</CardTitle>
        <CardDescription>
          Test the MCP client integration with Netlify functions
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col space-y-2">
            <label htmlFor="message" className="text-sm font-medium">
              Message
            </label>
            <Input
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your message here..."
              disabled={isLoading}
              className="w-full"
            />
          </div>
          
          <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Processing...' : 'Send Message'}
          </Button>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded">
            <p className="font-medium">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {response && (
          <div className="mt-4">
            <h3 className="text-lg font-medium mb-2">Response:</h3>
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md whitespace-pre-wrap">
              {response}
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="text-sm text-gray-500">
        <p>
          This component tests the MCP client integration with Netlify functions.
          Messages are processed by Claude via the MCP client.
        </p>
      </CardFooter>
    </Card>
  );
};

export default McpNetlifyChat;
