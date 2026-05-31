FROM node:20-alpine

WORKDIR /app

# Copy the package menu and install dependencies
COPY package*.json ./
RUN npm install

# Copy all your React code into the container
COPY . .

# Expose port 3000 so your Mac can see it
EXPOSE 3000

# Tell Vite to run the "dev" script, bind to the network, and use port 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]