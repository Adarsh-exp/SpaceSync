async function initOwnerReviews() {
  const user = ownerGuard("owner-reviews-root");
  if (!user) return;
  document.getElementById("nav-user").textContent = user.name;
  document.getElementById("nav-logout")?.addEventListener("click", e => { e.preventDefault(); doLogout(); });

  const reviews = await ownerFetch("/owner/reviews");
  const total = reviews.length || 1;
  const sentimentCount = {
    positive: reviews.filter(r => r.sentiment === "positive").length,
    neutral: reviews.filter(r => r.sentiment === "neutral").length,
    negative: reviews.filter(r => r.sentiment === "negative").length,
  };

  document.getElementById("owner-reviews-root").innerHTML = `
    <div class="owner-header"><div><h1 class="section-title">Reviews</h1><p class="section-sub">Reply publicly, track sentiment, and flag inappropriate reviews.</p></div></div>
    ${renderOwnerNav("reviews")}
    <div class="owner-panel">
      <div class="chart-title">Overall Sentiment</div>
      <div class="sentiment-bar">
        <div class="sentiment-positive" style="width:${(sentimentCount.positive / total) * 100}%"></div>
        <div class="sentiment-neutral" style="width:${(sentimentCount.neutral / total) * 100}%"></div>
        <div class="sentiment-negative" style="width:${(sentimentCount.negative / total) * 100}%"></div>
      </div>
      <div class="owner-card-meta mt-1">Positive ${sentimentCount.positive} · Neutral ${sentimentCount.neutral} · Negative ${sentimentCount.negative}</div>
    </div>
    <div class="owner-stack mt-2">
      ${reviews.length ? reviews.map(renderOwnerReviewCard).join("") : `<div class="empty-state">No reviews yet.</div>`}
    </div>`;
}

function renderOwnerReviewCard(review) {
  return `
    <div class="review-card">
      <div class="owner-toolbar">
        <div>
          <div class="owner-card-title">${review.space_name}</div>
          <div class="owner-card-meta">${review.user_name} · ${review.created_at.slice(0, 10)}</div>
        </div>
        <div class="flex gap-1">${statusBadge(review.sentiment)} ${review.is_flagged ? statusBadge("flagged") : ""}</div>
      </div>
      <div>${"*".repeat(review.rating)}${"_".repeat(5 - review.rating)}</div>
      <div>${review.comment || "No comment"}</div>
      <div class="reply-box">
        <textarea id="reply-${review.review_id}" placeholder="Write a public reply...">${review.reply_text || ""}</textarea>
        <div class="flex gap-1">
          <button class="btn btn-primary btn-sm" onclick="saveReviewReply(${review.review_id})">${review.reply_text ? "Update Reply" : "Post Reply"}</button>
          <button class="btn btn-ghost btn-sm" onclick="flagReview(${review.review_id})">Flag</button>
        </div>
      </div>
    </div>`;
}

async function saveReviewReply(reviewId) {
  try {
    const replyText = document.getElementById(`reply-${reviewId}`).value.trim();
    await ownerFetch(`/owner/reviews/${reviewId}/reply`, { method: "POST", body: JSON.stringify({ reply_text: replyText }) });
    toast("Reply saved");
    initOwnerReviews();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function flagReview(reviewId) {
  try {
    await ownerFetch(`/owner/reviews/${reviewId}/flag`, { method: "POST" });
    toast("Review flagged");
    initOwnerReviews();
  } catch (error) {
    toast(error.message, "error");
  }
}

initOwnerReviews();
