# Use an official Node.js runtime as a parent image
FROM node:20.18.1

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Generate a random secret key and set it as an environment variable
RUN SECRET_KEY=$(cat /dev/urandom | tr -dc A-Za-z0-9 | head -c 32) && \
    echo "SECRET_KEY=$SECRET_KEY" > .env

# Expose the port the app runs on
EXPOSE 8000 27018 2017 6380 6329

# Define the command to run the app
CMD ["npm", "run", "start-server"]

