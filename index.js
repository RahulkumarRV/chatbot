const mongoose = require("mongoose");
const xlsx = require("xlsx");
require('dotenv').config();
// MongoDB connection and schema definition
const connectionString = "mongodb://localhost:27017/yourDatabaseName"; // replace with your MongoDB URI

const conversationSchema = new mongoose.Schema({
    userNumber: String,
    messages: [{
        role: String,
        text: String,
        personality: String,
        timestamp: { type: Date, default: Date.now }
    }],
    lastInteraction: { type: Date, default: Date.now },
    rating: {
        extroverted: { recived: Boolean, stars: Number },
        introverted: { recived: Boolean, stars: Number }
    }
});

const Conversation = mongoose.model("Conversation", conversationSchema);

async function analyzeAndExportData() {
    mongoose.connect(process.env.MONGODB_URI).then(() => console.log("Connected to MongoDB"))
        .catch((err) => console.error("MongoDB connection error:", err));

    try {
        // Analysis 1: Average Rating for Each Personality
        const avgRatingResult = await Conversation.aggregate([
            {
                $group: {
                    _id: null,
                    avgRatingExtroverted: { $avg: "$rating.extroverted.stars" },
                    avgRatingIntroverted: { $avg: "$rating.introverted.stars" }
                }
            }
        ]);

        // Analysis 2: Total Conversations with Ratings for Each Personality
        const totalConversationsResult = await Conversation.aggregate([
            {
                $group: {
                    _id: null,
                    countExtroverted: { $sum: { $cond: [{ $eq: ["$rating.extroverted.recived", true] }, 1, 0] } },
                    countIntroverted: { $sum: { $cond: [{ $eq: ["$rating.introverted.recived", true] }, 1, 0] } }
                }
            }
        ]);

        // Analysis 3: Rating Distribution for Each Personality
        const ratingDistributionResult = await Conversation.aggregate([
            {
                $facet: {
                    extroverted: [
                        { $match: { "rating.extroverted.recived": true } },
                        { $group: { _id: "$rating.extroverted.stars", count: { $sum: 1 } } }
                    ],
                    introverted: [
                        { $match: { "rating.introverted.recived": true } },
                        { $group: { _id: "$rating.introverted.stars", count: { $sum: 1 } } }
                    ]
                }
            }
        ]);

        // Analysis 4: Average Conversation Length per Personality
        const avgConversationLengthResult = await Conversation.aggregate([
            { $unwind: "$messages" },
            {
                $group: {
                    _id: "$messages.personality",
                    avgMessages: { $avg: { $sum: 1 } }
                }
            }
        ]);

        // Analysis 5: Response Rate per Personality
        const responseRateResult = await Conversation.aggregate([
            {
                $group: {
                    _id: null,
                    responseRateExtroverted: {
                        $avg: { $cond: [{ $eq: ["$rating.extroverted.recived", true] }, 1, 0] }
                    },
                    responseRateIntroverted: {
                        $avg: { $cond: [{ $eq: ["$rating.introverted.recived", true] }, 1, 0] }
                    }
                }
            }
        ]);

        // Analysis 6: Total Messages per Personality
        const totalMessagesResult = await Conversation.aggregate([
            { $unwind: "$messages" },
            {
                $group: {
                    _id: "$messages.personality",
                    messageCount: { $sum: 1 }
                }
            }
        ]);

        // Prepare data for Excel
        const workbook = xlsx.utils.book_new();
        
        const metricsData = [
            {
                Metric: "Average Rating",
                Extroverted: avgRatingResult[0]?.avgRatingExtroverted || 0,
                Introverted: avgRatingResult[0]?.avgRatingIntroverted || 0
            },
            {
                Metric: "Total Conversations with Rating",
                Extroverted: totalConversationsResult[0]?.countExtroverted || 0,
                Introverted: totalConversationsResult[0]?.countIntroverted || 0
            },
            {
                Metric: "Response Rate",
                Extroverted: responseRateResult[0]?.responseRateExtroverted || 0,
                Introverted: responseRateResult[0]?.responseRateIntroverted || 0
            },
        ];

        const distributionData = [
            { Personality: "Extroverted", RatingDistribution: ratingDistributionResult[0].extroverted },
            { Personality: "Introverted", RatingDistribution: ratingDistributionResult[0].introverted }
        ];

        const messageData = [
            { Personality: "Extroverted", TotalMessages: totalMessagesResult.find(d => d._id === "extroverted")?.messageCount || 0 },
            { Personality: "Introverted", TotalMessages: totalMessagesResult.find(d => d._id === "introverted")?.messageCount || 0 }
        ];

        const conversationLengthData = avgConversationLengthResult.map(item => ({
            Personality: item._id,
            AvgConversationLength: item.avgMessages || 0
        }));

        // Adding data sheets
        const metricsSheet = xlsx.utils.json_to_sheet(metricsData);
        xlsx.utils.book_append_sheet(workbook, metricsSheet, "Metrics Summary");

        const distributionSheet = xlsx.utils.json_to_sheet(distributionData);
        xlsx.utils.book_append_sheet(workbook, distributionSheet, "Rating Distribution");

        const messageSheet = xlsx.utils.json_to_sheet(messageData);
        xlsx.utils.book_append_sheet(workbook, messageSheet, "Total Messages");

        const conversationLengthSheet = xlsx.utils.json_to_sheet(conversationLengthData);
        xlsx.utils.book_append_sheet(workbook, conversationLengthSheet, "Conversation Length");

        // Write to Excel file
        xlsx.writeFile(workbook, "ChatbotAnalysis.xlsx");
        console.log("Analysis completed and exported to ChatbotAnalysis.xlsx");

    } catch (error) {
        console.error("Error during analysis:", error);
    } finally {
        mongoose.connection.close();
    }
}

analyzeAndExportData();
