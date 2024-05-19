const express = require('express');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const ical = require('ical');
const path = require('path');
const app = express();
const port = 5000;
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.API_KEY); // Setup API Key
const model = genAI.getGenerativeModel({ model: "gemini-pro"});




app.use(bodyParser.json());
app.use(fileUpload());
app.use(express.static(path.join(__dirname, 'public')));

// Workout Scheduling
app.post('/schedule-workouts', async (req, res) => {
    try {
        // Check if uploaded
        if (!req.files || !req.files.calendar) {
            return res.status(400).send('No calendar file uploaded');
        }

        const calendarFile = req.files.calendar.data.toString();
        const parsedCalendar = ical.parseICS(calendarFile);

        // Get events from calendar
        const events = Object.values(parsedCalendar).filter(event => event.type === 'VEVENT');

        const { gender, age, weight, height, activityLevel, goal } = req.body;

        // Calculate BMI
        const bmi = weight / ((height / 100) ** 2);

        // Calculate BMR
        let bmr;
        if (gender === 'male') {
            bmr = 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age);
        } else {
            bmr = 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age);
        }

        // Calculate daily calorie needs based on activity level
        const activityMultipliers = {
            sedentary: 1.2,
            lightly_active: 1.375,
            moderately_active: 1.55,
            very_active: 1.725,
            extra_active: 1.9
        };
        const dailyCalories = bmr * activityMultipliers[activityLevel];

        // Calculate required calorie intake based on goal
        let calorieIntake;
        if (goal === 'lose_weight') {
            calorieIntake = dailyCalories - 500;
        } else if (goal === 'gain_weight') {
            calorieIntake = dailyCalories + 500;
        } else {
            calorieIntake = dailyCalories;
        }

        // Generate a basic workout routine based on goal
        const workoutRoutine = generateWorkoutRoutine(goal);

        // Find free slots for the entire week, limiting to one workout per day
        const freeSlots = findFreeSlots(events, 7); // Generate for 7 days
        if (freeSlots.length === 0) {
            throw new Error('No free slots available');
        }

        const dailyFreeSlots = freeSlots.filter((slot, index) => index % 24 === 0); // One slot per day

        const eventsData = dailyFreeSlots.map(slot => ({
            start: slot.start,
            end: slot.end,
            summary: 'Workout',
            description: workoutRoutine
        }));

        res.json({
            bmi: bmi.toFixed(2),
            dailyCalories: dailyCalories.toFixed(2),
            calorieIntake: calorieIntake.toFixed(2),
            calendarData: eventsData
        });
    } catch (error) {
        console.error('Error scheduling workouts:', error.message);
        res.status(500).send(`Error scheduling workouts: ${error.message}`);
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

// Function to generate a basic workout routine based on goal
function generateWorkoutRoutine(goal) {
    if (goal === 'lose_weight') {
        
        const prompt = "What is a good workout routine for someone that wants to lose weight"
        const result = model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        return 'text';
    } else if (goal === 'gain_weight') {


        const prompt = "What is a good workout routine for someone that wants to lose weight"
        const result = model.generateContent(prompt);
        const response = result.response;
        const text1 = response.text();

        return 'text1';
    } else {


        const prompt = "What is a good workout routine for someone that wants to lose weight"
        const result = model.generateContent(prompt);
        const response = result.response;
        const text2 = response.text();

        return 'text2';
    }
}


function roundToFiveMinutes(date) {
    const ms = 1000 * 60 * 5; // milliseconds in 5 minutes
    return new Date(Math.round(date.getTime() / ms) * ms);
}

// Function to find free slots
function findFreeSlots(events, days) {
    const freeSlots = [];
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000; // milliseconds in one day

    for (let i = 0; i < days; i++) {
        const dayStart = new Date(now.getTime() + i * oneDay);
        dayStart.setHours(6, 0, 0, 0); // Start at 6:00 AM

        const dayEnd = new Date(dayStart.getTime());
        dayEnd.setHours(22, 0, 0, 0); // End at 10:00 PM

        let currentTime = new Date(dayStart.getTime());

        while (currentTime < dayEnd) {
            const nextTime = new Date(currentTime.getTime() + 60 * 60 * 1000); // 1-hour slots
            if (isSlotFree(events, currentTime, nextTime)) {
                freeSlots.push({ start: roundToFiveMinutes(currentTime), end: roundToFiveMinutes(nextTime) });
            }
            currentTime = nextTime;
        }
    }
    return freeSlots;
}


function isSlotFree(events, start, end) {
    return !events.some(event => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        return (start < eventEnd && end > eventStart);
    });
}
