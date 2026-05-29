'use strict';

async function scan(filePath) {
  // TODO: wire ClamAV or cloud AV before production
  console.warn('[documentStore] AV scan not configured:', filePath);
  return { clean: true };
}

module.exports = { scan };
