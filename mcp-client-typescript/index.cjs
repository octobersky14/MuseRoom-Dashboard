// CommonJS wrapper for ES module
try {
  const { MCPClient } = require('./index.js');
  module.exports = { MCPClient };
} catch (error) {
  console.error('Error importing ES module:', error);
  // Attempt dynamic import as fallback
  (async () => {
    try {
      const { MCPClient } = await import('./index.js');
      module.exports = { MCPClient };
    } catch (err) {
      console.error('Dynamic import also failed:', err);
      throw err;
    }
  })();
}
