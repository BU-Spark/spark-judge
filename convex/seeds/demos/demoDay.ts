import { MutationCtx } from "../../_generated/server";
import { ensureSeedAdminUser } from "../shared/auth";

export async function seedDemoDayEventHandler(ctx: MutationCtx) {
  const userId = await ensureSeedAdminUser(ctx);

  // Get current date for relative date calculations
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;

  // Course codes for demo day
  const courseCodes = [
    "DS519",
    "DS539",
    "DS594",
    "DS549",
    "DS488/688",
    "DS701",
    "XC473",
  ];

  // Create demo day event
  const eventId = await ctx.db.insert("events", {
    name: "Demo Day Test Event 2024",
    description:
      "Test event for Demo Day showcasing student projects across multiple data science and cross-disciplinary courses.",
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
    mode: "demo_day" as const,
    courseCodes: courseCodes,
  });

  // Add current user as a judge for this event
  await ctx.db.insert("judges", {
    userId,
    eventId,
  });

  // Project ideas organized by course
  const projectsByCourse: Record<string, string[]> = {
    DS519: [
      "Predictive Analytics Dashboard",
      "Customer Churn Prediction System",
      "Sales Forecasting Model",
      "Market Trend Analysis Platform",
      "Risk Assessment Tool",
      "Demand Forecasting System",
    ],
    DS539: [
      "Deep Learning Image Classifier",
      "Neural Network Optimization Framework",
      "Computer Vision Pipeline",
      "Natural Language Processing API",
      "Reinforcement Learning Agent",
      "Transfer Learning Toolkit",
    ],
    DS594: [
      "Big Data Processing Pipeline",
      "Distributed Computing Framework",
      "Real-time Analytics Platform",
      "Data Lake Management System",
      "Stream Processing Engine",
      "Scalable ML Training System",
    ],
    DS549: [
      "Interactive Data Visualization Suite",
      "Statistical Analysis Dashboard",
      "Hypothesis Testing Framework",
      "Experimental Design Tool",
      "A/B Testing Platform",
      "Regression Analysis Interface",
    ],
    "DS488/688": [
      "Capstone Project Management System",
      "Industry Partnership Platform",
      "Research Data Repository",
      "Thesis Project Tracker",
      "Collaborative Research Tool",
      "Academic Portfolio Builder",
    ],
    DS701: [
      "Advanced ML Research Platform",
      "Algorithm Benchmarking System",
      "Research Paper Analysis Tool",
      "Experimental Framework",
      "Theoretical Model Validator",
      "Publication Data Analyzer",
    ],
    XC473: [
      "Cross-Disciplinary Innovation Hub",
      "Interdisciplinary Research Platform",
      "Collaborative Project Space",
      "Multi-Domain Analysis Tool",
      "Integrated Research Dashboard",
      "Cross-Functional Analytics System",
    ],
  };

  // Team name templates
  const teamNameTemplates = [
    "Data Pioneers",
    "Analytics Squad",
    "ML Innovators",
    "Insight Engineers",
    "Pattern Finders",
    "Algorithm Architects",
  ];

  // Project descriptions
  const projectDescriptions = [
    "A comprehensive solution leveraging advanced analytics to solve real-world problems.",
    "An innovative platform combining cutting-edge technology with practical applications.",
    "A robust system designed to handle complex data challenges with scalable architecture.",
    "An intuitive interface for exploring and analyzing large datasets efficiently.",
    "A powerful tool that transforms raw data into actionable insights.",
    "A sophisticated application demonstrating best practices in data science.",
  ];

  let teamsCreated = 0;

  // Create at least 5 projects per course
  for (const courseCode of courseCodes) {
    const projects = projectsByCourse[courseCode] || [];
    const projectsToCreate = Math.max(5, projects.length);

    for (let i = 0; i < projectsToCreate; i++) {
      const projectName = projects[i] || `${courseCode} Project ${i + 1}`;
      const teamName =
        teamNameTemplates[i % teamNameTemplates.length] + ` ${courseCode} ${i + 1}`;
      const description =
        projectDescriptions[i % projectDescriptions.length] +
        ` Focused on ${courseCode} curriculum.`;

      await ctx.db.insert("teams", {
        eventId: eventId,
        name: teamName,
        description: description,
        members: [
          `Student ${i * 3 + 1} (${courseCode})`,
          `Student ${i * 3 + 2} (${courseCode})`,
          `Student ${i * 3 + 3} (${courseCode})`,
        ],
        projectUrl: `https://github.com/${courseCode.toLowerCase().replace("/", "-")}/project-${i + 1}`,
        githubUrl: `https://github.com/${courseCode.toLowerCase().replace("/", "-")}/project-${i + 1}`,
        track: "",
        courseCode: courseCode,
        submittedBy: userId,
        submittedAt: now.getTime() - day + Math.random() * day,
      });
      teamsCreated++;
    }
  }

  return {
    message: `Successfully created Demo Day test event with ${teamsCreated} projects across ${courseCodes.length} courses`,
    eventId,
    teamsCreated,
  };
}
