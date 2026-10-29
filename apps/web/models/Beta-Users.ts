// models/BetaUsers.ts
import mongoose, { Schema, Document } from "mongoose";


export interface IBetaUsers extends Document {
    userId: number;
    email: string;
    formResponses: Record<string, any>;
    waitListId: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const BetaUsersSchema: Schema = new Schema(
    {
        userId: {
            type: Number,
            unique: true,
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            trim: true,
            lowercase: true,
        },
        formResponses: {
            type: Schema.Types.Mixed,
            default: {},
        },
        waitListId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'WaitList', // 👈 model name, not collection name
            required: true,
            unique: true, // Optional: enforces 1:1 mapping
        }
    },
    {
        timestamps: true,
        collection: "beta_users",
    }
);

// Add auto-increment functionality for userId
BetaUsersSchema.pre('save', async function (next) {
    if (this.isNew && !this.userId) {
        try {
            // Find the highest existing userId and increment
            const lastUser = await (this.constructor as mongoose.Model<IBetaUsers>)
                .findOne({}, {}, { sort: { 'userId': -1 } });
            
            let nextNumber = 1;
            if (lastUser && lastUser.userId) {
                nextNumber = lastUser.userId + 1;
            }
            
            this.userId = nextNumber;
        } catch (error) {
            return next(error as Error);
        }
    }
    next();
});

// Create a compound index for better performance
// BetaUsersSchema.index({ userId: 1 });
// BetaUsersSchema.index({ email: 1 });

// Export the model
// Check if the model already exists before creating a new one to prevent overwrite errors
export default mongoose.models.BetaUsers || mongoose.model<IBetaUsers>("BetaUsers", BetaUsersSchema);
