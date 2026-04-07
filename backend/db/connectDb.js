import mongoose from "mongoose"

export const connectDb = async () => {
    try {
        const connect = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDb connected : ${connect.connection.host}`)
        return true;
    } catch (error) {
        console.log("Error connection to the db ",error.message);
        return false;
    }
}
