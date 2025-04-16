#!/usr/bin/node

/**
 * PromoCodeController handles promo code operations.
 * Includes creating, retrieving, updating, and listing promo codes.
 */

import PromoCode from "../models/promocode.js";

class PromoCodeController {
  /**
   * Create a new promo code.
   */
  static async createPromoCode(req, res) {
    try {
      const { code, discount_percent, expires_at, description } = req.body;

      if (!code || !discount_percent || !expires_at) {
        return res.status(400).send({
          success: false,
          error: "Missing required fields: code, discount_percent or expires_at",
        });
      }

      const existing = await PromoCode.get({ code });
      if (existing) {
        return res.status(400).send({
          success: false,
          error: "Promo code already exists",
        });
      }

      const promo = new PromoCode(code, discount_percent, expires_at, description);
      const result = await promo.save();

      if (!result) {
        return res.status(500).send({
          success: false,
          error: "Failed to save promo code",
        });
      }

      return res.status(201).send({
        success: true,
        promo: promo.to_object(),
      });
    } catch (e) {
      return res.status(500).send({ success: false, error: e.message });
    }
  }

  /**
   * List all promo codes or filter by query.
   */
  static async listPromoCodes(req, res) {
    try {
      const filters = req.query || {};
      const promos = await PromoCode.all(filters);
      return res.status(200).send({
        success: true,
        promos,
      });
    } catch (e) {
      return res.status(500).send({ success: false, error: e.message });
    }
  }

  /**
   * Update a promo code.
   */
  static async updatePromoCode(req, res) {
    try {
      const { code } = req.params;
      const updates = req.body;

      if (!code) {
        return res.status(400).send({
          success: false,
          error: "Missing promo code identifier",
        });
      }

      let promo = await PromoCode.get({ code });
      if (!promo) {
        return res.status(404).send({
          success: false,
          error: "Promo code not found",
        });
      }

      promo = PromoCode.from_object(promo);
      await promo.updateInstance(updates);

      return res.status(200).send({
        success: true,
        promo: promo.to_object(),
      });
    } catch (e) {
      return res.status(500).send({ success: false, error: e.message });
    }
  }

  /**
   * Deactivate a promo code.
   */
  static async deactivatePromoCode(req, res) {
    try {
      const { code } = req.params;

      const promo = await PromoCode.get({ code });
      if (!promo) {
        return res.status(404).send({
          success: false,
          error: "Promo code not found",
        });
      }

      const promoObj = PromoCode.from_object(promo);
      await promoObj.updateInstance({ active: false });

      return res.status(200).send({
        success: true,
        message: "Promo code deactivated",
      });
    } catch (e) {
      return res.status(500).send({ success: false, error: e.message });
    }
  }
}

export default PromoCodeController;
