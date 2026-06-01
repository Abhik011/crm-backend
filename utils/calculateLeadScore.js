// utils/calculateLeadScore.js

export const calculateLeadScore = (
  lead
) => {

  let score = 0;

  /* =========================
     DESIGNATION
  ========================= */

  const designation =
    (
      lead.designation || ""
    ).toLowerCase();

  if (
    designation.includes(
      "owner"
    )
  )
    score += 25;

  if (
    designation.includes(
      "founder"
    )
  )
    score += 25;

  if (
    designation.includes(
      "ceo"
    )
  )
    score += 25;

  if (
    designation.includes(
      "director"
    )
  )
    score += 20;

  if (
    designation.includes(
      "manager"
    )
  )
    score += 10;

  /* =========================
     INDUSTRY
  ========================= */

  const industry =
    (
      lead.company
        ?.industry || ""
    ).toLowerCase();

  if (
    industry.includes(
      "logistics"
    )
  )
    score += 15;

  if (
    industry.includes(
      "transport"
    )
  )
    score += 15;

  if (
    industry.includes(
      "fleet"
    )
  )
    score += 10;

  /* =========================
     SOURCE
  ========================= */

  if (
    lead.source ===
    "LinkedIn"
  )
    score += 10;

  if (
    lead.source ===
    "Apollo"
  )
    score += 15;

  if (
    lead.source ===
    "Referral"
  )
    score += 20;

  /* =========================
     CONTACT QUALITY
  ========================= */

  if (
    lead.email &&
    lead.email !== "none"
  )
    score += 10;

  if (
    lead.phone &&
    lead.phone !== "0000"
  )
    score += 5;

  if (
    lead.socials?.linkedin
  )
    score += 10;

  /* =========================
     ENGAGEMENT
  ========================= */

  if (
    lead.status ===
    "Interested"
  )
    score += 20;

  if (
    lead.status ===
    "Negotiation"
  )
    score += 30;

  if (
    lead.status ===
    "Qualified"
  )
    score += 40;

  /* =========================
     FOLLOWUP EXISTS
  ========================= */

  if (
    lead.followUps
      ?.length > 0
  )
    score += 5;

  /* =========================
     CAP SCORE
  ========================= */

  if (score > 100)
    score = 100;

  return score;
};