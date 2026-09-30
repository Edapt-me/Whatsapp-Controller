require("dotenv").config();

const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { GoogleGenAI } = require("@google/genai");

const {
    getConversationHistory,
    saveMessage,
    clearConversationHistory
} = require("./database");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: ".wwebjs_auth"
    }),
    puppeteer: {
        headless: true
    }
});

client.on("qr", (qr) => {
    console.log("\nScan this QR code with WhatsApp:\n");
    qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
    console.log("WhatsApp authentication successful.");
});

client.on("ready", () => {
    console.log("=================================");
    console.log("WhatsApp Bot is READY");
    console.log("=================================");
});

client.on("auth_failure", (message) => {
    console.error("Authentication failure:", message);
});

client.on("disconnected", (reason) => {
    console.warn("WhatsApp disconnected:", reason);
});

async function isGroupAdmin(groupId, senderId) {
    try {
        return await client.pupPage.evaluate(
            ({ groupId, senderId }) => {

                const chatWid =
                    window.require("WAWebWidFactory").createWid(groupId);

                const chat =
                    window.require("WAWebCollections").Chat.get(chatWid);

                if (!chat) {
                    return false;
                }

                const participants =
                    chat.groupMetadata?.participants || [];

                let senderParticipant = null;

                participants.forEach((participant) => {
                    const participantId =
                        participant.id?._serialized || null;

                    if (participantId === senderId) {
                        senderParticipant = participant;
                    }
                });

                if (!senderParticipant) {
                    return false;
                }

                return senderParticipant.isAdmin === true;
            },
            {
                groupId,
                senderId
            }
        );

    } catch (error) {
        console.error("Admin check failed:", error.message);
        return false;
    }
}
async function isGroupAdmin(groupId, senderId) {
    try {
        return await client.pupPage.evaluate(
            ({ groupId, senderId }) => {
                const chatWid =
                    window.require("WAWebWidFactory").createWid(groupId);

                const chat =
                    window.require("WAWebCollections").Chat.get(chatWid);

                if (!chat) {
                    return false;
                }

                const participants =
                    chat.groupMetadata?.participants || [];

                let senderParticipant = null;

                participants.forEach((participant) => {
                    const participantId =
                        participant.id?._serialized || null;

                    if (participantId === senderId) {
                        senderParticipant = participant;
                    }
                });

                if (!senderParticipant) {
                    return false;
                }

                return senderParticipant.isAdmin === true;
            },
            {
                groupId,
                senderId
            }
        );
    } catch (error) {
        console.error("Admin check failed:", error.message);
        return false;
    }
}


async function getGroupInfo(groupId) {
    try {
        return await client.pupPage.evaluate((chatId) => {
            const chatWid =
                window.require("WAWebWidFactory").createWid(chatId);

            const chat =
                window.require("WAWebCollections").Chat.get(chatWid);

            if (!chat) {
                return null;
            }

            const participants =
                chat.groupMetadata?.participants || [];

            let memberCount = 0;

            participants.forEach(() => {
                memberCount++;
            });

            return {
                id: chat.id?._serialized || null,
                name: chat.formattedTitle || null,
                memberCount
            };
        }, groupId);
    } catch (error) {
        console.error("Group info error:", error.message);
        return null;
    }
}
async function getGroupAdmins(groupId) {
    try {
        return await client.pupPage.evaluate((chatId) => {
            const chatWid =
                window.require("WAWebWidFactory").createWid(chatId);

            const chat =
                window.require("WAWebCollections").Chat.get(chatWid);

            if (!chat) {
                return [];
            }

            const participants =
                chat.groupMetadata?.participants || [];

            const admins = [];

            participants.forEach((participant) => {
                if (participant.isAdmin === true) {
                    admins.push({
                        id: participant.id?._serialized || null,
                        isSuperAdmin: participant.isSuperAdmin === true
                    });
                }
            });

            return admins;
        }, groupId);

    } catch (error) {
        console.error("Get admins error:", error.message);
        return [];
    }
}
async function getParticipantName(participantId) {
    try {
        return await client.pupPage.evaluate((participantId) => {
            const widFactory = window.require("WAWebWidFactory");
            const contactCollection =
                window.require("WAWebCollections").Contact;

            const wid = widFactory.createWid(participantId);

            const contact = contactCollection.get(wid);

            if (!contact) {
                return {
                    id: participantId,
                    name: null
                };
            }

            return {
                id: participantId,
                name:
                    contact.name ||
                    contact.pushname ||
                    contact.shortName ||
                    contact.notifyName ||
                    null
            };
        }, participantId);

    } catch (error) {
        console.error(
            "Participant name lookup failed:",
            error.message
        );

        return {
            id: participantId,
            name: null
        };
    }
}
async function askGemini(prompt, history = []) {

    const model = "gemini-3.5-flash-lite";

    const systemInstruction =
        "You are Edapt's WhatsApp AI assistant. " +
        "Answer the user's exact question clearly and naturally. " +
        "Use the conversation history to understand follow-up questions and context. " +
        "If the user says 'it', 'this', 'that', 'they', 'he', 'she', " +
        "or asks 'how is it different', use the previous conversation to understand the meaning. " +
        "Do not ask for clarification when the meaning can reasonably be understood from the conversation history. " +
        "Do not unnecessarily correct spelling or assume the user made a mistake. " +
        "Keep normal answers concise, usually 1 to 3 sentences. " +
        "For lists, use clear numbered or bulleted points. " +
        "For writing requests, provide ready-to-use text. " +
        "Use simple language suitable for WhatsApp.";

    try {

        console.log(`Gemini model: ${model}`);
        console.log(`Memory messages: ${history.length}`);

        const contents = [
            ...history,
            {
                role: "user",
                parts: [
                    {
                        text: prompt
                    }
                ]
            }
        ];

        const response = await ai.models.generateContent({
            model: model,

            config: {
                systemInstruction,
                temperature: 0.3,
                maxOutputTokens: 300
            },

            contents
        });

        console.log(
            `Gemini response received from ${model}`
        );

        return response.text;

    } catch (error) {

        const errorMessage = error.message || "";

        console.error(
            "Gemini request failed:",
            errorMessage
        );

        if (
            errorMessage.includes('"code":429') ||
            errorMessage.includes("RESOURCE_EXHAUSTED")
        ) {
            console.log("Gemini quota exceeded.");

            return null;
        }

        if (
            errorMessage.includes('"code":503') ||
            errorMessage.includes("UNAVAILABLE")
        ) {
            console.log("Gemini is temporarily unavailable.");

            return null;
        }

        return null;
    }
}
client.on("message", async (message) => {
    try {
        const body = message.body.trim();

        if (!body) {
            return;
        }

        // ==========================================
        // @edapt AI COMMAND
        // ==========================================

        if (body.toLowerCase().startsWith("@edapt")) {

            const prompt = body.slice(6).trim();

            // ------------------------------------------
            // Empty prompt
            // ------------------------------------------

            if (!prompt) {
                await message.reply(
                    "Please provide a question.\n\n" +
                    "Example:\n" +
                    "@edapt what is artificial intelligence?"
                );

                return;
            }

            // ------------------------------------------
            // Identify group and member
            // ------------------------------------------

            const groupId = message.from;

            const memberId =
                message.author || message.from;

            console.log("\n========== AI REQUEST ==========");
            console.log("AI Prompt:", prompt);
            console.log("Group:", groupId);
            console.log("Member:", memberId);
            console.log("================================");

            // ------------------------------------------
            // RESET MEMORY
            // ------------------------------------------

            if (prompt.toLowerCase() === "reset") {

                clearConversationHistory(
                    groupId,
                    memberId
                );

                await message.reply(
                    "🧹 Your AI conversation memory has been cleared."
                );

                console.log(
                    "AI memory cleared for:",
                    groupId,
                    memberId
                );

                return;
            }

            // ------------------------------------------
            // Load this member's conversation
            // ------------------------------------------

            const history = getConversationHistory(
                groupId,
                memberId,
                10
            );

            console.log(
                "Previous memory messages:",
                history.length
            );

            // ------------------------------------------
            // Show thinking message
            // ------------------------------------------

            await message.reply(
                "🤖 Thinking..."
            );

            // ------------------------------------------
            // Ask Gemini
            // ------------------------------------------

            const answer = await askGemini(
                prompt,
                history
            );

            // ------------------------------------------
            // Gemini failed
            // ------------------------------------------

            if (!answer) {

                await message.reply(
                    "Sorry, I couldn't get a response from Gemini right now."
                );

                return;
            }

            // ------------------------------------------
            // Save user question
            // ------------------------------------------

            saveMessage(
                groupId,
                memberId,
                "user",
                prompt
            );

            // ------------------------------------------
            // Save AI response
            // ------------------------------------------

            saveMessage(
                groupId,
                memberId,
                "model",
                answer
            );

            console.log(
                "Conversation saved to SQLite."
            );

            // ------------------------------------------
            // Send AI response
            // ------------------------------------------

            await message.reply(
                "🤖 AI Assistant\n\n" +
                answer
            );

            return;
        }


        // ==========================================
        // NORMAL ! COMMANDS
        // ==========================================

        if (!body.startsWith("!")) {
            return;
        }

        const parts = body.slice(1).trim().split(/\s+/);

        const command = parts[0]?.toLowerCase();
        const args = parts.slice(1);

        console.log("\n========== COMMAND ==========");
        console.log("Command:", command);
        console.log("Arguments:", args);
        console.log("From:", message.from);
        console.log("Author:", message.author);
        console.log("=============================");


        // --------------------------------
        // !HELP
        // --------------------------------

        if (command === "help") {

            await message.reply(
                "🤖 WhatsApp Bot Commands\n\n" +
                "!help - Show available commands\n" +
                "!groupinfo - Show group information (Admin only)\n" +
                "!admins - Show group admins\n\n" +
                "@edapt <question> - Ask Gemini AI\n" +
                "@edapt reset - Clear your AI memory"
            );

            return;
        }
        // --------------------------------
        // !ADMINS
        // --------------------------------

        if (command === "admins") {

            if (!message.from.endsWith("@g.us")) {
                await message.reply(
                    "This command can only be used inside a WhatsApp group."
                );

                return;
            }

            const admins = await getGroupAdmins(message.from);

            if (admins.length === 0) {
                await message.reply(
                    "Unable to retrieve group admins."
                );

                return;
            }

            let response = "👥 Group Admins\n\n";

            for (let i = 0; i < admins.length; i++) {

                const admin = admins[i];

                const participant =
                    await getParticipantName(admin.id);

                const displayName =
                    participant.name || admin.id;

                response += `${i + 1}. ${displayName}`;

                if (admin.isSuperAdmin) {
                    response += " (Super Admin)";
                }

                response += "\n";
            }

            await message.reply(response);

            return;
        }





        // --------------------------------
        // GROUP-ONLY COMMANDS
        // --------------------------------

        if (command === "groupinfo") {

            // Make sure command is being used inside a group
            if (!message.from.endsWith("@g.us")) {
                await message.reply(
                    "This command can only be used inside a WhatsApp group."
                );

                return;
            }

            // Check whether sender is an admin
            const senderIsAdmin = await isGroupAdmin(
                message.from,
                message.author
            );

            console.log("Sender Is Admin:", senderIsAdmin);


            // --------------------------------
            // ADMIN CHECK
            // --------------------------------

            if (!senderIsAdmin) {
                await message.reply(
                    "Sorry, this command is available only to group admins."
                );

                return;
            }


            // --------------------------------
            // GET GROUP INFORMATION
            // --------------------------------

            const groupInfo = await getGroupInfo(message.from);

            if (!groupInfo) {
                await message.reply(
                    "Unable to retrieve group information."
                );

                return;
            }


            // --------------------------------
            // SEND RESPONSE
            // --------------------------------

            const response =
                "📋 Group Information\n\n" +
                `Group: ${groupInfo.name}\n` +
                `Members: ${groupInfo.memberCount}\n` +
                "Your role: Admin";

            await message.reply(response);

            return;
        }


        // --------------------------------
        // UNKNOWN COMMAND
        // --------------------------------

        await message.reply(
            `Unknown command: !${command}\n\n` +
            "Type !help to see available commands."
        );

    } catch (error) {
        console.error("\nError processing command:", error);
    }
});

client.initialize();