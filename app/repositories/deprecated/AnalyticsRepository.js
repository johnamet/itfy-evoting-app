/**
 * Analytics Repository (Improved)
 * Handles database operations for analytics data with enhanced forecasting,
 * anomaly detection, and optimized aggregations.
 */

import BaseRepository from "./BaseRepository.js";
import Analytics from "../models/Analytics.js";
import Vote from "../models/Vote.js";
import Event from "../models/Event.js";
import User from "../models/User.js";
import Payment from "../models/Payment.js";
import Candidate from "../models/Candidate.js";
import Category from "../models/Category.js";

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

  // ---------------- OVERVIEW ----------------
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
        Candidate.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
        Category.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
        Event.countDocuments({ status: "active" }),
        Event.countDocuments({ status: "completed", endDate: { $lte: endDate } }),
      ]);

      const paymentAgg = await Payment.aggregate([
        {
          $match: { status: "success", paidAt: { $gte: startDate, $lte: endDate } },
        },
        { $group: { _id: null, totalRevenue: { $sum: "$finalAmount" } } },
      ]);

      const totalRevenue = paymentAgg[0]?.totalRevenue || 0;

      const votes = totalVotes;
      const payments = await Payment.countDocuments({
        paidAt: { $gte: startDate, $lte: endDate },
        status: "success",
      });

      const participationRate = payments > 0 ? (votes / payments) * 100 : 0;
      const ci = this.calculateWilsonInterval(votes, payments);

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
      throw new Error("AnalyticsComputationError: overview failed");
    }
  }

  // ---------------- VOTING ----------------
  async computeVotingAnalytics(startDate, endDate, eventId = null) {
    const startTime = Date.now();
    try {
      const matchStage = { votedAt: { $gte: startDate, $lte: endDate } };
      if (eventId) matchStage.event = eventId;

      const [votingStats, votesPerHour, topCandidates, categoryBreakdown] =
        await Promise.allSettled([
          this._aggregateVotingStats(matchStage),
          this._aggregateVotesPerHour(matchStage),
          this._aggregateTopCandidates(matchStage),
          this._aggregateCategoryBreakdown(matchStage),
        ]);

      const stats = votingStats.value?.[0] || {};
      const totalVotes = stats.votes || 0;
      const totalVotesCast = stats.totalBundleVotes || 0;
      const uniqueVoters = stats.uniqueVoters?.length || 0;
      const hourData = votesPerHour.value || [];
      const anomalyScore = this.calculateAnomalyScore(hourData);

      return {
        type: "voting",
        period: "daily",
        dateRange: { start: startDate, end: endDate },
        data: {
          voting: {
            totalVotes,
            totalVotesCast,
            uniqueVoters,
            averageVotesPerVoter: uniqueVoters > 0 ? totalVotes / uniqueVoters : 0,
            votingRate: uniqueVoters > 0 ? (totalVotes / uniqueVoters) * 100 : 0,
            peakVotingHour: hourData.reduce(
              (max, curr) => (max.votes > curr.votes ? max : curr),
              { votes: 0 }
            )._id?.hour || null,
            votesPerHour: hourData.map((h) => ({
              date: h._id.date,
              hour: h._id.hour,
              votes: h.votes,
              totalVotesCast: h.totalBundleVotes,
              ci: this.calculateWilsonInterval(h.votes, Math.max(1, totalVotes / 24)),
            })),
            topCandidates: (topCandidates.value || []).map((c) => ({
              candidate: c._id,
              votes: c.votes,
              totalCastVotes: c.totalBundleVotes,
              percentage: c.percentage,
              pValue: this.calculateChiSquarePValue(c.votes, totalVotes),
            })),
            categoryBreakdown: (categoryBreakdown.value || []).map((c) => ({
              category: c._id,
              votes: c.votes,
              totalCastVotes: c.totalBundleVotes,
              percentage: c.percentage,
              pValue: this.calculateChiSquarePValue(c.votes, totalVotes),
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
      throw new Error("AnalyticsComputationError: voting failed");
    }
  }

   // ---------------- PAYMENTS ----------------
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

      const totalTransactions = paymentAgg.reduce((sum, p) => sum + p.count, 0);
      const totalRevenue = paymentAgg.find((p) => p._id === "success")?.total || 0;
      const successfulPayments = paymentAgg.find((p) => p._id === "success")?.count || 0;
      const failedPayments = paymentAgg.find((p) => p._id === "failed")?.count || 0;
      const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
      const conversionFunnel = await this.calculateConversionFunnel(startDate, endDate);
      const paymentMethods = (paymentAgg.find((p) => p._id === "success")?.paymentMethods) || [];

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
      const redemptionRate = totalCouponsUsed > 0 ? (totalDiscount / totalRevenue) * 100 : 0;
      const fraudIndicator = this.calculateFraudIndicator(failedPayments, totalTransactions);

      console.log("Payment Methods Breakdown:", paymentAgg);

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
            revenueGrowth: await this.calculateGrowthRate(totalRevenue, startDate, endDate),
            paymentMethods: paymentMethods.map((method) => ({
              method,
              count:
                paymentAgg.find((p) => p._id === "success" && p.paymentMethods.includes(method))?.count || 0,
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

   // ---------------- ANOMALIES ----------------
  async computeAnomalyAnalytics(startDate, endDate) {
    const startTime = Date.now();
    try {
      const voteAgg = await Vote.aggregate([
        { $match: { votedAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d %H:00", date: "$votedAt" } },
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

  // ---------------- AGGREGATION HELPERS ----------------
  _aggregateVotingStats(matchStage) {
    return Vote.aggregate([
      { $match: matchStage },
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
          _id: null,
          uniqueVoters: { $addToSet: "$voter.email" },
          votes: { $sum: 1 },
          totalBundleVotes: { $sum: "$bundle.votes" },
        },
      },
    ]);
  }

  _aggregateVotesPerHour(matchStage) {
    return Vote.aggregate([
      { $match: matchStage },
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
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$votedAt" } },
            hour: { $hour: "$votedAt" },
          },
          votes: { $sum: 1 },
          totalBundleVotes: { $sum: "$bundle.votes" },
        },
      },
      { $sort: { "_id.date": 1, "_id.hour": 1 } },
    ]);
  }

  _aggregateTopCandidates(matchStage) {
    return Vote.aggregate([
      { $match: matchStage },
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
          _id: "$candidate",
          votes: { $sum: 1 },
          totalBundleVotes: { $sum: "$bundle.votes" },
        },
      },
      {
        $lookup: {
          from: "candidates",
          localField: "_id",
          foreignField: "_id",
          as: "candidate",
        },
      },
      { $unwind: "$candidate" },
      {
        $setWindowFields: {
          partitionBy: null,
          output: { grandTotal: { $sum: "$totalBundleVotes" } },
        },
      },
      {
        $project: {
          candidate: 1,
          votes: 1,
          totalBundleVotes: 1,
          percentage: {
            $multiply: [{ $divide: ["$totalBundleVotes", "$grandTotal"] }, 100],
          },
        },
      },
      { $sort: { totalBundleVotes: -1 } },
    ]);
  }

  _aggregateCategoryBreakdown(matchStage) {
    return Vote.aggregate([
      { $match: matchStage },
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
          votes: { $sum: 1 },
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
      { $unwind: "$category" },
      {
        $setWindowFields: {
          partitionBy: null,
          output: { grandTotal: { $sum: "$totalBundleVotes" } },
        },
      },
      {
        $project: {
          category: 1,
          votes: 1,
          totalBundleVotes: 1,
          percentage: {
            $multiply: [{ $divide: ["$totalBundleVotes", "$grandTotal"] }, 100],
          },
        },
      },
      { $sort: { totalBundleVotes: -1 } },
    ]);
  }

  // ---------------- FORECASTS ----------------
  async computeForecasts(startDate, endDate) {
    const startTime = Date.now();
    try {
      const revenueData = await Payment.aggregate([
        { $match: { status: "success", paidAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$paidAt" } },
            totalRevenue: { $sum: "$finalAmount" },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      const voteAgg = await Vote.aggregate([
        {
          $match: {
            votedAt: {
              $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
              $lte: endDate,
            },
          },
        },
        {
          $facet: {
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

      const monthlyVotes = voteAgg[0]?.monthlyTotals || [];

      const revenueForecast = this.holtWintersForecast(
        revenueData.map((d) => d.totalRevenue)
      );
      const voteForecast = this.holtWintersForecast(
        monthlyVotes.map((d) => d.totalVotes)
      );
      const bundleVoteForecast = this.holtWintersForecast(
        monthlyVotes.map((d) => d.totalBundleVotes)
      );

      return {
        type: "forecasts",
        period: "monthly",
        dateRange: { start: startDate, end: endDate },
        data: {
          forecasts: {
            revenueTrend: revenueForecast,
            voteTrend: voteForecast,
            bundleVoteTrend: bundleVoteForecast,
          },
        },
        metadata: {
          computedAt: new Date(),
          computationTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      console.error("Error computing forecasts:", error);
      throw new Error("AnalyticsComputationError: forecasts failed");
    }
  }

  // ---------------- PRIVATE HELPERS ----------------
  calculateWilsonInterval(n, N) {
    if (N === 0) return { lower: 0, upper: 0 };
    const z = 1.96;
    const phat = n / N;
    const denominator = 1 + (z * z) / N;
    const centre = phat + (z * z) / (2 * N);
    const margin =
      z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * N)) / N) / denominator;
    return {
      lower: Math.max(0, (centre - margin) / denominator),
      upper: Math.min(1, (centre + margin) / denominator),
    };
  }

  calculateChiSquarePValue(observed, total) {
    if (total === 0) return 1;
    const expected = total / 2;
    const chiSquare = Math.pow(observed - expected, 2) / expected;
    return chiSquare > 3.841 ? 0.05 : 1;
  }

  calculateAnomalyScore(data) {
    if (!data || data.length === 0) return 0;
    const values = data.map((d) => d.votes || 0);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
    );
    return values.some((v) => (v - mean) / (stdDev || 1) > 3) ? 0.8 : 0;
  }

  calculateSystemHealthScore(totalEvents, activeEvents, completedEvents) {
    return totalEvents > 0
      ? (activeEvents / totalEvents) * 50 + (completedEvents / totalEvents) * 50
      : 0;
  }

 // Holt-Winters Forecast (additive trend, no seasonality)
  holtWintersForecast(data, alpha = 0.5, beta = 0.3, horizon = 3) {
    if (!Array.isArray(data) || data.length < 2) return [];

    let level = data[0];
    let trend = data[1] - data[0];
    const forecasts = [];

    for (let t = 1; t < data.length; t++) {
      const value = data[t];
      const lastLevel = level;
      level = alpha * value + (1 - alpha) * (level + trend);
      trend = beta * (level - lastLevel) + (1 - beta) * trend;
    }

    for (let i = 1; i <= horizon; i++) {
      forecasts.push({
        period: `next_${i}_month`,
        predicted: Math.max(0, level + i * trend),
      });
    }

    return forecasts;
  }


  detectAnomalies(data) {
    if (!data || data.length === 0) return [];
    const mean = data.reduce((sum, d) => sum + d, 0) / data.length;
    const stdDev = Math.sqrt(
      data.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / data.length
    );
    return data
      .map((d) => ({ value: d, z: (d - mean) / (stdDev || 1) }))
      .filter((r) => r.z > 3)
      .map((r) => ({
        type: "vote_spike",
        details: { timestamp: new Date(), zScore: r.z, value: r.value },
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
    return rate > 0.1 ? 0.9 : Math.min(1, rate * 10);
  }

  calculateSystemHealthScore(totalEvents, activeEvents, completedEvents) {
    return totalEvents > 0
      ? (activeEvents / totalEvents) * 50 + (completedEvents / totalEvents) * 50
      : 0;
  }
}

export default AnalyticsRepository;
