const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// Ensure data directory exists
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "conversation_memory.db");
const db = new Database(dbPath);

// Enable WAL mode for better concurrency and write performance
db.pragma("journal_mode = WAL");

// Initialize table and index
db.exec(`
    CREATE TABLE IF NOT EXISTS conversation_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id TEXT NOT NULL,
        member_id TEXT NOT NULL,
        role TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_group_member_id 
    ON conversation_messages(group_id, member_id, id);
`);

/**
 * Retrieve recent conversation history for a specific member in a group.
 * Returns messages in chronological order, formatted for Gemini contents.
 */
function getConversationHistory(groupId, memberId, limit = 10) {
    const stmt = db.prepare(`
        SELECT role, text FROM (
            SELECT id, role, text
            FROM conversation_messages
            WHERE group_id = ? AND member_id = ?
            ORDER BY id DESC
            LIMIT ?
        )
        ORDER BY id ASC
    `);

    const rows = stmt.all(groupId, memberId, limit);

    return rows.map((row) => ({
        role: row.role,
        parts: [
            {
                text: row.text
            }
        ]
    }));
}

/**
 * Save a message (user prompt or model response) to database.
 */
function saveMessage(groupId, memberId, role, text) {
    const stmt = db.prepare(`
        INSERT INTO conversation_messages (group_id, member_id, role, text)
        VALUES (?, ?, ?, ?)
    `);

    return stmt.run(groupId, memberId, role, text);
}

/**
 * Clear conversation memory for a specific member in a group.
 */
function clearConversationHistory(groupId, memberId) {
    const stmt = db.prepare(`
        DELETE FROM conversation_messages
        WHERE group_id = ? AND member_id = ?
    `);

    return stmt.run(groupId, memberId);
}

module.exports = {
    db,
    getConversationHistory,
    saveMessage,
    clearConversationHistory
};
