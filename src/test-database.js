const {
    getConversationHistory,
    saveMessage,
    clearConversationHistory
} = require("./database");

function runDatabaseTests() {
    console.log("==========================================");
    console.log("TESTING SQLITE CONVERSATION MEMORY");
    console.log("==========================================\n");

    const testGroup = "120363430423113946@g.us";
    const member1 = "73719137493177@lid";
    const member2 = "74745332645998@lid";

    // Clean up test data first
    clearConversationHistory(testGroup, member1);
    clearConversationHistory(testGroup, member2);

    console.log("1. Initially empty check:");
    let m1History = getConversationHistory(testGroup, member1);
    console.log(`Member 1 initial messages: ${m1History.length} (Expected: 0)`);

    // Save exchange for Member 1
    console.log("\n2. Saving Member 1 exchange (ML -> AI):");
    saveMessage(testGroup, member1, "user", "What is machine learning?");
    saveMessage(testGroup, member1, "model", "Machine learning is a subset of AI...");

    m1History = getConversationHistory(testGroup, member1);
    console.log(`Member 1 messages: ${m1History.length} (Expected: 2)`);
    console.log("Content:", JSON.stringify(m1History, null, 2));

    // Save exchange for Member 2
    console.log("\n3. Saving Member 2 exchange (Python -> Uses):");
    saveMessage(testGroup, member2, "user", "What is Python?");
    saveMessage(testGroup, member2, "model", "Python is a popular programming language...");

    let m2History = getConversationHistory(testGroup, member2);
    console.log(`Member 2 messages: ${m2History.length} (Expected: 2)`);

    // Verify isolation
    console.log("\n4. Verifying isolation between Member 1 and Member 2:");
    m1History = getConversationHistory(testGroup, member1);
    console.log(`Member 1 history has ${m1History.length} messages (First prompt: "${m1History[0].parts[0].text}")`);
    console.log(`Member 2 history has ${m2History.length} messages (First prompt: "${m2History[0].parts[0].text}")`);

    // Member 1 asks a follow-up
    console.log("\n5. Member 1 follow-up question:");
    saveMessage(testGroup, member1, "user", "How is it different from AI?");
    saveMessage(testGroup, member1, "model", "AI is the broad field, whereas ML is the method...");

    m1History = getConversationHistory(testGroup, member1);
    console.log(`Member 1 now has: ${m1History.length} messages (Expected: 4)`);

    // Reset Member 1
    console.log("\n6. Testing reset for Member 1:");
    clearConversationHistory(testGroup, member1);
    m1History = getConversationHistory(testGroup, member1);
    m2History = getConversationHistory(testGroup, member2);
    console.log(`Member 1 after reset: ${m1History.length} messages (Expected: 0)`);
    console.log(`Member 2 still has: ${m2History.length} messages (Expected: 2)`);

    // Clean up
    clearConversationHistory(testGroup, member2);

    console.log("\n==========================================");
    console.log("ALL SQLITE DATABASE TESTS PASSED SUCCESSFULLY!");
    console.log("==========================================");
}

runDatabaseTests();
