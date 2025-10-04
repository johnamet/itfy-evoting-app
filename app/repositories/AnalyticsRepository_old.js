/**
 * Analytics Repository
 * Handles database operations for analytics data with enhanced aggregations.
 */

import BaseRepository from "./BaseRepository.js";
import Analytics from "../models/Analytics.js";
import Vote from "../models/Vote.js";
import Event from "../models/Event.js";
import User from "../models/User.js";
import Payment from "../models/Payment.js";
import Candidate from "../models/Candidate.js";
import Category from "../models/Category.js";
import Activity from "../models/Activity.js";
import Form from "../models/Form.js";

class AnalyticsRepository extends BaseRepository {
  constructor() {
    super(Analytics);
  }

  async findByTypeAndPeriod(type, period, options = {}) {
    return await this.model.findByTypeAndPeriod(type, period, options);
  }

  async findFreshOrCreate(type, period, references = {}) {
    return await this.model.findFreshOrCreate(type, period, references);
  }

  async computeOverviewAnalytics(startDate, endDate) {
    const startTime = Date.now();
    try {
      const [
        totalUsers,
        totalEvents,
        totalVotes,
        totalCandidates,
        totalCategories,
        activeEvents,
        completedEvents,
      ] = await Promise.all([
        User.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
        Event.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
        Vote.countDocuments({ votedAt: { $gte: startDate, $lte: endDate } }),
        Candidate.countDocuments({
          createdAt: { $gte: startDate, $lte: endDate },
        }),
        Category.countDocuments({
          createdAt: { $gte: startDate, $lte: endDate },
        }),
        Event.countDocuments({ status: "active" }),
        Event.countDocuments({
          status: "completed",
          endDate: { $lte: endDate },
        }),
      ]);

      const paymentAgg = await Payment.aggregate([
        {
          $match: {
            status: "success",
            paidAt: { $gte: startDate, $lte: endDate },
          },
        },
        { $group: { _id: null, totalRevenue: { $sum: "$finalAmount" } } },
      ]);

      const totalRevenue = paymentAgg[0]?.totalRevenue || 0;

      const votes = await Vote.countDocuments({
        votedAt: { $gte: startDate, $lte: endDate },
      });
      const payments = await Payment.countDocuments({
        paidAt: { $gte: startDate, $lte: endDate },
        status: "success",
      });
      const participationRate = payments > 0 ? (votes / payments) * 100 : 0;
      const ci = this.calculateConfidenceInterval(votes, payments);

      const overviewData = {
        totalUsers,
        totalEvents,
        totalVotes,
        totalRevenue,
        activeEvents,
        completedEvents,
        totalCandidates,
        totalCategories,
        overallParticipationRate: participationRate,
        ciParticipationRate: ci,
        systemHealthScore: this.calculateSystemHealthScore(
          totalEvents,
          activeEvents,
          completedEvents
        ),
      };

      return {
        type: "overview",
        period: "daily",
        dateRange: { start: startDate, end: endDate },
        data: { overview: overviewData },
        metadata: {
          computedAt: new Date(),
          computationTime: Date.now() - startTime,
          dataPoints: Object.keys(overviewData).length,
        },
        status: "completed",
      };
    } catch (error) {
      console.error("Error computing overview analytics:", error);
      throw error;
    }
  }

  async computeVotingAnalytics(startDate, endDate, eventId = null) {
    const startTime = Date.now();
    try {
      const matchStage = { votedAt: { $gte: startDate, $lte: endDate } };
      if (eventId) matchStage.event = eventId;

      const [votingStats, votesPerHour, topCandidates, categoryBreakdown] =
        await Promise.all([
          Vote.aggregate([
            { $unwind: { path: "$voteBundles" } },
            {
              $lookup: {
                from: "voteBundles",
                localField: "voteBundles",
                foreignField: "_id",
                as: "bundle",
              },
            },
            {
              $group: {
                _id: null,
                uniqueVoters: { $addToSet: "$voter.email" },
                votes: { $sum: 1 },
                allBundles: { $push: "$bundle.votes" },
              },
            },
            {
              $project: {
                votes: 1,
                uniqueVoters: 1,
                totalBundleVotes: {
                  $sum: {
                    $reduce: {
                      input: "$allBundles",
                      initialValue: [],
                      in: { $concatArrays: ["$$value", "$$this"] },
                    },
                  },
                },
              },
            },
          ]),

          // 2. Votes per hour (with date included)
          Vote.aggregate([
            { $match: matchStage },
            { $unwind: { path: "$voteBundles" } },
            {
              $lookup: {
                from: "voteBundles",
                localField: "voteBundles",
                foreignField: "_id",
                as: "bundle",
              },
            },
            {
              $group: {
                _id: {
                  date: {
                    $dateToString: { format: "%Y-%m-%d", date: "$votedAt" },
                  },
                  hour: { $hour: "$votedAt" },
                },
                votes: { $sum: 1 },
                allBundles: { $push: "$bundle.votes" },
              },
            },
            {
              $project: {
                _id: "$_id",
                votes: 1,
                totalBundleVotes: {
                  $sum: {
                    $reduce: {
                      input: "$allBundles",
                      initialValue: [],
                      in: { $concatArrays: ["$$value", "$$this"] },
                    },
                  },
                },
              },
            },
            { $sort: { "_id.date": 1, "_id.hour": 1 } },
          ]),
          Vote.aggregate([
            { $match: matchStage },
            // expand voteBundles array
            { $unwind: "$voteBundles" },

            // bring in bundle docs
            {
              $lookup: {
                from: "voteBundles",
                localField: "voteBundles",
                foreignField: "_id",
                as: "bundle",
              },
            },
            { $unwind: "$bundle" },

            // group per candidate
            {
              $group: {
                _id: "$candidate",
                votes: { $sum: 1 }, // raw vote count
                totalBundleVotes: { $sum: "$bundle.votes" }, // sum of bundle votes
              },
            },

            // lookup candidate info
            {
              $lookup: {
                from: "candidates",
                localField: "_id",
                foreignField: "_id",
                as: "candidate",
              },
            },
            { $unwind: "$candidate" },

            // compute grand total using window function
            {
              $setWindowFields: {
                partitionBy: null,
                output: {
                  grandTotal: { $sum: "$totalBundleVotes" },
                },
              },
            },

            // project with percentage
            {
              $project: {
                candidate: 1,
                votes: 1,
                totalBundleVotes: 1,
                percentage: {
                  $multiply: [
                    { $divide: ["$totalBundleVotes", "$grandTotal"] },
                    100,
                  ],
                },
              },
            },

            { $sort: { totalBundleVotes: -1 } },
          ]),
          Vote.aggregate([
            { $match: matchStage },
            // expand voteBundles array
            { $unwind: "$voteBundles" },

            // bring in bundle docs
            {
              $lookup: {
                from: "voteBundles",
                localField: "voteBundles",
                foreignField: "_id",
                as: "bundle",
              },
            },
            { $unwind: "$bundle" },

            // group per category
            {
              $group: {
                _id: "$category",
                votes: { $sum: 1 }, // raw vote count
                totalBundleVotes: { $sum: "$bundle.votes" }, // sum of bundle votes
              },
            },
            {
              $lookup: {
                from: "categories",
                localField: "_id",
                foreignField: "_id",
                as: "category",
              },
            },
            // compute grand total using window function
            {
              $setWindowFields: {
                partitionBy: null,
                output: {
                  grandTotal: { $sum: "$totalBundleVotes" },
                },
              },
            },

            // project with percentage
            {
              $project: {
                category: 1,
                votes: 1,
                totalBundleVotes: 1,
                percentage: {
                  $multiply: [
                    { $divide: ["$totalBundleVotes", "$grandTotal"] },
                    100,
                  ],
                },
              },
            },

            { $sort: { totalBundleVotes: -1 } },
          ]),
        ]);

      const totalVotes = votingStats[0]?.votes || 0;
      const totalVotesCast = votingStats[0]?.totalBundleVotes || 0;
      const uniqueVoters = votingStats[0]?.uniqueVoters?.length || 0;
      const anomalyScore = this.calculateAnomalyScore(votesPerHour);

      return {
        type: "voting",
        period: "daily",
        dateRange: { start: startDate, end: endDate },
        data: {
          voting: {
            totalVotes,
            totalVotesCast,
            uniqueVoters,
            averageVotesPerVoter:
              uniqueVoters > 0 ? totalVotes / uniqueVoters : 0,
            votingRate:
              uniqueVoters > 0 ? (totalVotes / uniqueVoters) * 100 : 0,
            peakVotingHour: votesPerHour.reduce(
              (max, curr) => (max.votes > curr.votes ? max : curr),
              { votes: 0 }
            ).hour,
            votesPerHour: votesPerHour.map((h) => ({
              date: h._id.date,
              hour: h._id.hour,
              votes: h.votes,
              totalVotesCast: h.totalBundleVotes,
              ci: this.calculateConfidenceInterval(h.votes, totalVotes / 24),
            })),
            topCandidates: topCandidates.map((c) => ({
              candidate: c._id,
              votes: c.votes,
              totalCastVotes: c.totalBundleVotes,
              percentage: c.percentage,
              pValue: this.calculatePValue(c.votes, totalVotes),
            })),
            categoryBreakdown: categoryBreakdown.map((c) => ({
              category: c._id,
              votes: c.votes,
              totalCastVotes: c.totalBundleVotes,
              percentage: c.percentage,
              pValue: this.calculatePValue(c.votes, totalVotes),
            })),
            anomalyScore,
          },
        },
        metadata: {
          computedAt: new Date(),
          computationTime: Date.now() - startTime,
          dataPoints: totalVotes,
        },
      };
    } catch (error) {
      console.error("Error computing voting analytics:", error);
      throw error;
    }
  }

  async computePaymentAnalytics(startDate, endDate) {
    const startTime = Date.now();
    try {
      const paymentAgg = await Payment.aggregate([
        { $match: { paidAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            total: { $sum: "$finalAmount" },
            avg: { $avg: "$finalAmount" },
            paymentMethods: { $addToSet: "$paystackData.channel" },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      console.log("Payment Agg", paymentAgg);

      const totalTransactions = paymentAgg.reduce((sum, p) => sum + p.count, 0);
      const totalRevenue =
        paymentAgg.find((p) => p._id === "success")?.total || 0;
      const successfulPayments =
        paymentAgg.find((p) => p._id === "success")?.count || 0;
      const failedPayments =
        paymentAgg.find((p) => p._id === "failed")?.count || 0;
      const avgTransactionValue =
        totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
      const conversionFunnel = await this.calculateConversionFunnel(
        startDate,
        endDate
      );
      const paymentMethods =
        (await paymentAgg.find((p) => p._id === "success")?.paymentMethods) ||
        [];

      const couponAgg = await Payment.aggregate([
        {
          $match: {
            paidAt: { $gte: startDate, $lte: endDate },
            status: "success",
          },
        },
        {
          $lookup: {
            from: "couponusages",
            localField: "_id",
            foreignField: "paymentId",
            as: "coupons",
          },
        },
        {
          $group: {
            _id: null,
            totalCouponsUsed: { $sum: { $size: "$coupons" } },
            totalDiscount: { $sum: { $sum: "$coupons.discountAmount" } },
          },
        },
      ]);
      const totalCouponsUsed = couponAgg[0]?.totalCouponsUsed || 0;
      const totalDiscount = couponAgg[0]?.totalDiscount || 0;
      const redemptionRate =
        totalCouponsUsed > 0 ? (totalDiscount / totalRevenue) * 100 : 0;
      const fraudIndicator = this.calculateFraudIndicator(
        failedPayments,
        totalTransactions
      );

      console.log("Payment Methods", paymentMethods);
      return {
        type: "payments",
        period: "daily",
        dateRange: { start: startDate, end: endDate },
        data: {
          payments: {
            totalRevenue,
            totalTransactions,
            successfulPayments,
            failedPayments,
            avgTransactionValue,
            revenueGrowth: this.calculateGrowthRate(
              totalRevenue,
              startDate,
              endDate
            ),
            paymentMethods: paymentMethods.map((method) => ({
              method,
              count:
                paymentAgg.find(
                  (p) =>
                    p._id === "success" && p.paymentMethods.includes(method)
                )?.count || 0,
            })),
            couponUsage: {
              totalCouponsUsed,
              totalDiscount,
              redemptionRate,
              topCoupons: [],
            },
            conversionFunnel,
            fraudIndicator,
          },
        },
        metadata: {
          computedAt: new Date(),
          computationTime: Date.now() - startTime,
          dataPoints: totalTransactions,
        },
      };
    } catch (error) {
      console.error("Error computing payment analytics:", error);
      throw error;
    }
  }

  async computeAnomalyAnalytics(startDate, endDate) {
    const startTime = Date.now();
    try {
      const voteAgg = await Vote.aggregate([
        { $match: { votedAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d %H:00", date: "$votedAt" },
            },
            votes: { $sum: 1 },
          },
        },
      ]);
      const anomalies = this.detectAnomalies(voteAgg.map((v) => v.votes));

      return {
        type: "anomalies",
        period: "daily",
        dateRange: { start: startDate, end: endDate },
        data: { anomalies },
        metadata: {
          computedAt: new Date(),
          computationTime: Date.now() - startTime,
          anomalyFlags: anomalies.length,
        },
      };
    } catch (error) {
      console.error("Error computing anomaly analytics:", error);
      throw error;
    }
  }

  async computeForecasts(startDate, endDate) {
    const startTime = Date.now();
    try {
      const revenueData = await Payment.aggregate([
        { $match: { status: "success" } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$paidAt" } },
            totalRevenue: { $sum: "$finalAmount" },
          },
        },
        { $sort: { _id: 1 } },
      ]);
      const voteData = await Vote.aggregate([
        {
          $match: {
            votedAt: {
              $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // last 90 days
              $lte: endDate,
            },
          },
        },
        {
          $facet: {
            // -------- Category breakdown with percentages --------
            categoryBreakdown: [
              { $unwind: "$voteBundles" },
              {
                $lookup: {
                  from: "voteBundles",
                  localField: "voteBundles",
                  foreignField: "_id",
                  as: "bundle",
                },
              },
              { $unwind: "$bundle" },
              {
                $group: {
                  _id: "$category",
                  votes: { $sum: 1 }, // raw count of votes
                  totalBundleVotes: { $sum: "$bundle.votes" },
                },
              },
              {
                $lookup: {
                  from: "categories",
                  localField: "_id",
                  foreignField: "_id",
                  as: "category",
                },
              },
              {
                $setWindowFields: {
                  partitionBy: null,
                  output: {
                    grandTotal: { $sum: "$totalBundleVotes" },
                  },
                },
              },
              {
                $project: {
                  category: 1,
                  votes: 1,
                  totalBundleVotes: 1,
                  percentage: {
                    $multiply: [
                      { $divide: ["$totalBundleVotes", "$grandTotal"] },
                      100,
                    ],
                  },
                },
              },
              { $sort: { totalBundleVotes: -1 } },
            ],

            // -------- Monthly totals (with raw + bundle votes) --------
            monthlyTotals: [
              { $unwind: "$voteBundles" },
              {
                $lookup: {
                  from: "voteBundles",
                  localField: "voteBundles",
                  foreignField: "_id",
                  as: "bundle",
                },
              },
              { $unwind: "$bundle" },
              {
                $group: {
                  _id: { $dateToString: { format: "%Y-%m", date: "$votedAt" } },
                  totalVotes: { $sum: 1 },
                  totalBundleVotes: { $sum: "$bundle.votes" },
                },
              },
              { $sort: { _id: 1 } },
            ],
          },
        },
      ]);

      const revenueForecast = this.generateForecast(
        revenueData.map((d) => d.totalRevenue)
      );
      const voteForecast = this.generateForecast(
        voteData.map((d) => d.totalVotes)
      );

      console.log("Revenue Forecast", revenueForecast);
      console.log("Vote Forecast", voteForecast);

      return {
        type: "forecasts",
        period: "monthly",
        dateRange: { start: startDate, end: endDate },
        data: {
          forecasts: { revenueTrend: revenueForecast, voteTrend: voteForecast },
        },
        metadata: {
          computedAt: new Date(),
          computationTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      console.error("Error computing forecasts:", error);
      throw error;
    }
  }

  // Helper methods
  calculateConfidenceInterval(n, N) {
    if (N === 0) return { lower: 0, upper: 0 };
    const p = n / N;
    const z = 1.96; // 95% CI
    const se = Math.sqrt((p * (1 - p)) / N);
    const margin = z * se;
    return { lower: Math.max(0, p - margin), upper: Math.min(1, p + margin) };
  }

  calculatePValue(observed, total) {
    // Simplified chi-square p-value approximation
    const expected = total / 2;
    const chiSquare = Math.pow(observed - expected, 2) / expected;
    return chiSquare > 3.841 ? 0.05 : 1; // 95% significance threshold
  }

  calculateAnomalyScore(data) {
    const mean = data.reduce((sum, d) => sum + d.votes, 0) / data.length;
    const stdDev = Math.sqrt(
      data.reduce((sum, d) => sum + Math.pow(d.votes - mean, 2), 0) /
        data.length
    );
    return data.some((d) => (d.votes - mean) / stdDev > 3) ? 0.8 : 0; // 3σ threshold
  }

  detectAnomalies(data) {
    const mean = data.reduce((sum, d) => sum + d, 0) / data.length;
    const stdDev = Math.sqrt(
      data.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / data.length
    );
    return data
      .filter((d) => (d - mean) / stdDev > 3)
      .map((d) => ({
        type: "vote_spike",
        details: { timestamp: new Date(), zScore: (d - mean) / stdDev },
      }));
  }

  async calculateGrowthRate(current, startDate, endDate) {
    const prevPeriod = new Date(startDate.getTime() - (endDate - startDate));
    const prevRevenue = await Payment.aggregate([
      {
        $match: {
          status: "success",
          paidAt: { $gte: prevPeriod, $lt: startDate },
        },
      },
      { $group: { _id: null, total: { $sum: "$finalAmount" } } },
    ]);
    return prevRevenue[0]?.total > 0
      ? ((current - prevRevenue[0].total) / prevRevenue[0].total) * 100
      : 0;
  }

  calculateConversionFunnel(startDate, endDate) {
    return Payment.aggregate([
      { $match: { paidAt: { $gte: startDate, $lte: endDate } } },
      {
        $lookup: {
          from: "votes",
          localField: "_id",
          foreignField: "paymentId",
          as: "votes",
        },
      },
      {
        $group: {
          _id: null,
          totalPayments: { $sum: 1 },
          votesCast: { $sum: { $size: "$votes" } },
        },
      },
    ]).then((result) => ({
      paidToVotes: result[0]?.votesCast / result[0]?.totalPayments || 0,
    }));
  }

  calculateFraudIndicator(failed, total) {
    const rate = total > 0 ? failed / total : 0;
    return rate > 0.1 ? 0.9 : rate * 10; // Scale 0-1, flag if >10%
  }

  calculateSystemHealthScore(totalEvents, activeEvents, completedEvents) {
    return totalEvents > 0
      ? (activeEvents / totalEvents) * 50 + (completedEvents / totalEvents) * 50
      : 0;
  }

  generateForecast(data) {
    if (data.length < 3) return [];
    const x = Array.from({ length: data.length }, (_, i) => i);
    const y = data;
    const n = data.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const forecast = [];
    for (let i = 1; i <= 3; i++) {
      const pred = slope * (n + i - 1) + intercept;
      forecast.push({
        period: `next_${i}_month`,
        predicted: Math.max(0, pred),
        ciLow: pred * 0.9,
        ciHigh: pred * 1.1,
      });
    }

    console.log("Forecast result:", forecast);
    return forecast;
  }
}

export default AnalyticsRepository;
