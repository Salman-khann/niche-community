import mongoose from "mongoose"

export const connectDb = async () => {
    try {
        const connect = await mongoose.connect(process.env.MONGO_URI, {
            maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || "50", 10),
            minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE || "5", 10),
            maxIdleTimeMS: parseInt(process.env.MONGO_MAX_IDLE_MS || "30000", 10),
            serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || "10000", 10),
            socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT_MS || "45000", 10),
        });
        console.log(`MongoDb connected : ${connect.connection.host}`)
        return true;
    } catch (error) {
        console.log("Error connection to the db ",error.message);
        return false;
    }
}
