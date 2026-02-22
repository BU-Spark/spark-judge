import { Id } from "../../_generated/dataModel";
import { MutationCtx } from "../../_generated/server";

export async function seedEventsHandler(ctx: MutationCtx) {
  // Clear existing events (optional)
  const existingEvents = await ctx.db.query("events").collect();
  for (const event of existingEvents) {
    await ctx.db.delete(event._id);
  }

  // Get current date for relative date calculations
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;

  // Seed events data
  const events = [
    // Active Events
    {
      name: "HackBU Fall 2024",
      description:
        "Boston University's premier 24-hour hackathon. Build innovative solutions, attend workshops, and compete for amazing prizes!",
      startDate: now.getTime() - day,
      endDate: now.getTime() + day,
      status: "active" as const,
      categories: [
        { name: "Innovation", weight: 1 },
        { name: "Technical Implementation", weight: 1.2 },
        { name: "Design", weight: 1 },
        { name: "Impact", weight: 1.3 },
        { name: "Presentation", weight: 0.8 },
      ],
      resultsReleased: false,
      teamCount: 42,
    },
    {
      name: "AI Innovation Challenge",
      description:
        "48-hour AI hackathon focused on building practical AI applications using cutting-edge LLMs and computer vision.",
      startDate: now.getTime() - 2 * day,
      endDate: now.getTime() + 2 * day,
      status: "active" as const,
      categories: [
        { name: "AI Innovation", weight: 1.2 },
        { name: "Technical Complexity", weight: 1.4 },
        { name: "User Experience", weight: 1.1 },
        { name: "Scalability", weight: 1 },
        { name: "Presentation", weight: 0.9 },
      ],
      resultsReleased: false,
      teamCount: 28,
    },

    // Upcoming Events
    {
      name: "Web3 Builder Weekend",
      description:
        "Explore the future of decentralized applications. Learn Solidity, build DApps, and create the next breakthrough in blockchain.",
      startDate: now.getTime() + 7 * day,
      endDate: now.getTime() + 9 * day,
      status: "upcoming" as const,
      categories: [
        { name: "Smart Contract Security", weight: 1.3 },
        { name: "DApp Usability", weight: 1.1 },
        { name: "Innovation", weight: 1 },
        { name: "Technical Excellence", weight: 1.2 },
        { name: "Presentation", weight: 0.8 },
      ],
      resultsReleased: false,
      teamCount: 0,
    },
    {
      name: "HealthTech Hackathon",
      description:
        "Revolutionize healthcare with technology. Partner with Boston hospitals to solve real medical challenges.",
      startDate: now.getTime() + 14 * day,
      endDate: now.getTime() + 16 * day,
      status: "upcoming" as const,
      categories: [
        { name: "Clinical Impact", weight: 1.5 },
        { name: "Innovation", weight: 1 },
        { name: "Technical Implementation", weight: 1.2 },
        { name: "User Experience", weight: 1.1 },
        { name: "Scalability", weight: 0.9 },
      ],
      resultsReleased: false,
      teamCount: 0,
    },
    {
      name: "Climate Action Hack",
      description:
        "Code for our planet! Build sustainable tech solutions to combat climate change and promote environmental conservation.",
      startDate: now.getTime() + 21 * day,
      endDate: now.getTime() + 22 * day,
      status: "upcoming" as const,
      categories: [
        { name: "Environmental Impact", weight: 1.5 },
        { name: "Innovation", weight: 1 },
        { name: "Technical Solution", weight: 1.2 },
        { name: "Feasibility", weight: 1 },
        { name: "Presentation", weight: 0.8 },
      ],
      resultsReleased: false,
      teamCount: 0,
    },

    // Past Events
    {
      name: "Spring Hack 2024",
      description:
        "Our flagship spring hackathon brought together 200+ hackers to build amazing projects over an intense weekend.",
      startDate: now.getTime() - 60 * day,
      endDate: now.getTime() - 58 * day,
      status: "past" as const,
      categories: [
        { name: "Innovation", weight: 1 },
        { name: "Technical Excellence", weight: 1.3 },
        { name: "Design", weight: 1 },
        { name: "Impact", weight: 1.2 },
        { name: "Presentation", weight: 0.9 },
      ],
      resultsReleased: true,
      teamCount: 52,
    },
    {
      name: "FinTech Innovation Lab",
      description:
        "Disrupting finance with code. Teams built solutions for payments, investing, and financial inclusion.",
      startDate: now.getTime() - 30 * day,
      endDate: now.getTime() - 28 * day,
      status: "past" as const,
      categories: [
        { name: "Financial Impact", weight: 1.3 },
        { name: "Innovation", weight: 1 },
        { name: "Security", weight: 1.4 },
        { name: "User Experience", weight: 1.1 },
        { name: "Scalability", weight: 1 },
      ],
      resultsReleased: true,
      teamCount: 35,
    },
    {
      name: "Game Jam 2024",
      description:
        "48 hours to create the next indie game sensation. From concept to playable demo in one weekend.",
      startDate: now.getTime() - 90 * day,
      endDate: now.getTime() - 88 * day,
      status: "past" as const,
      categories: [
        { name: "Gameplay", weight: 1.5 },
        { name: "Graphics", weight: 1.1 },
        { name: "Sound Design", weight: 0.9 },
        { name: "Innovation", weight: 1 },
        { name: "Fun Factor", weight: 1.4 },
      ],
      resultsReleased: true,
      teamCount: 24,
    },
  ];

  // Insert all events
  const eventIds: Id<"events">[] = [];
  for (const event of events) {
    const { teamCount: _teamCount, ...eventData } = event;
    const id = await ctx.db.insert("events", eventData);
    eventIds.push(id);
  }

  // Create some dummy teams for active and past events
  const teamNames = [
    "Code Crusaders",
    "Bit Wizards",
    "Debug Dynasty",
    "Syntax Squad",
    "The Recursives",
    "Stack Overflow",
    "Neural Ninjas",
    "Quantum Coders",
    "Binary Brigade",
    "Cache Money",
    "Git Committed",
    "Array of Sunshine",
    "The Null Pointers",
    "Exception Handlers",
    "Runtime Terror",
    "Merge Conflicts",
  ];

  const projectTypes = [
    "AI-powered study assistant",
    "Blockchain voting system",
    "Mental health chatbot",
    "Carbon footprint tracker",
    "Smart home automation",
    "Virtual reality education",
    "Crowd-sourced delivery app",
    "Medical diagnosis tool",
    "Social media analyzer",
    "Sustainable fashion marketplace",
    "Fitness tracking platform",
    "Language learning game",
  ];

  // Add teams to active and past events
  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    // Skip upcoming events
    if (event.status === "upcoming") continue;

    const eventId = eventIds[i];
    const teamCount = event.teamCount;

    for (let j = 0; j < Math.min(teamCount, 10); j++) {
      // Add up to 10 teams per event for demo
      await ctx.db.insert("teams", {
        eventId: eventId,
        name: teamNames[j % teamNames.length],
        description: projectTypes[j % projectTypes.length],
        members: [
          `Member ${j * 3 + 1}`,
          `Member ${j * 3 + 2}`,
          `Member ${j * 3 + 3}`,
        ],
        projectUrl: `https://github.com/team${j}/hackathon-project`,
        githubUrl: "",
        track: "",
      });
    }
  }

  return {
    message: "Successfully seeded database with dummy events and teams",
    eventsCreated: events.length,
    eventIds,
  };
}
