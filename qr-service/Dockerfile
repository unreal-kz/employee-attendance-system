# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY qr-service/package*.json ./

# Install app dependencies
RUN npm install

# Copy app source code
COPY qr-service/ .

# Copy frontend files
COPY frontend/ ./frontend/

# Expose the port the app runs on
EXPOSE 3000

# Define the command to run the app
CMD [ "npm", "start" ] 