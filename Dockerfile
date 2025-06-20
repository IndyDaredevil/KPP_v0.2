# Use a lightweight Node.js image as the base
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to leverage Docker cache
# This step is crucial for efficient caching: if only package.json changes,
# npm ci will be re-run. If only source code changes, this layer is cached.
COPY package.json package-lock.json ./

# Copy railway.json for Railway deployment configuration
COPY railway.json ./

# Install backend dependencies
# Use --omit=dev to only install production dependencies
RUN npm ci --omit=dev

# Copy the backend application code
COPY src/ ./src/

# Expose the port the application listens on
# Changed from port 3000 to 8080 for Railway compatibility
EXPOSE 8080

# Command to run the application
# This uses the "start\" script defined in package.json
CMD ["npm", "start"]