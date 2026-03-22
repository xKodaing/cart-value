import { useState, useRef } from "react";

// ─── PRICING ENGINE ───
// Base values = approximate NEW retail price (what a new one sells for)
// Anchor: EZGO TXT reconditioned sells ~$5,000 at 11 yrs old
const BRANDS = {
  "Club Car Onward": { tier: 1, base: 12000 },
  "Club Car Tempo": { tier: 1, base: 11500 },
  "Club Car Precedent": { tier: 1, base: 10000 },
  "Club Car DS": { tier: 1, base: 8500 },
  "EZGO TXT": { tier: 1, base: 11000 },
  "EZGO RXV": { tier: 1, base: 11500 },
  "EZGO Liberty/Freedom": { tier: 1, base: 12000 },
  "Yamaha Drive2": { tier: 2, base: 9500 },
  "Yamaha G29/Drive": { tier: 2, base: 8000 },
  "Evolution": { tier: 3, base: 7500 },
  "Icon": { tier: 3, base: 7000, avoidTrade: true },
  "Tomberlin": { tier: 3, base: 6000, avoidTrade: true },
  "Advanced EV": { tier: 3, base: 5500, avoidTrade: true },
  "Star EV / Bintelli": { tier: 3, base: 6500 },
  "Other / Unknown": { tier: 3, base: 5500 },
};

const CONDITION_MULT = {
  excellent: 1.0,
  good: 0.88,
  fair: 0.72,
  poor: 0.50,
};

// Battery adjustments based on real costs
// Bad batteries = ~$1,000-1,200 dealer cost to replace, so deduct that
const BATTERY_ADJ = {
  new_lithium: 1500,
  new_lead: 500,
  good: 0,
  aging: -400,
  bad: -1000,
  unknown: -600,
};

// Issue deductions based on real shop costs
const ISSUE_COSTS = {
  tires: 500,
  seats: 350,
  controller: 800,
  motor: 900,
  body: 500,
  charger: 300,
  brakes: 200,
  windshield: 167,
};

function getAge(year) {
  return 2026 - year;
}

// Much flatter depreciation — carts hold value well
// Anchor: 2015 EZGO TXT (11 yrs) good condition = ~$5,000 retail
// $5,000 / $10,500 base = ~0.48 at 11 years
function getDepreciation(age) {
  if (age <= 0) return 1.0;
  if (age === 1) return 0.88;
  if (age === 2) return 0.82;
  if (age === 3) return 0.77;
  if (age === 4) return 0.73;
  if (age === 5) return 0.69;
  if (age <= 7) return 0.62;
  if (age <= 10) return 0.54;
  if (age <= 13) return 0.47;
  if (age <= 16) return 0.40;
  if (age <= 20) return 0.34;
  if (age <= 25) return 0.28;
  return 0.22;
}

function calculateValue(formData) {
  const brand = BRANDS[formData.brand];
  if (!brand) return null;

  const age = getAge(formData.year);
  const depreciation = getDepreciation(age);
  const condMult = CONDITION_MULT[formData.condition] || 0.65;
  const batteryAdj = BATTERY_ADJ[formData.batteries] || 0;

  let issueDeductions = 0;
  (formData.issues || []).forEach((issue) => {
    issueDeductions += ISSUE_COSTS[issue] || 0;
  });

  // Seat count adjustment
  const seatAdj = formData.seats === "6" ? 800 : formData.seats === "2" ? -400 : 0;

  // Fair market value = what it's worth in a fair private transaction
  let fairValue = brand.base * depreciation * condMult + batteryAdj - issueDeductions + seatAdj;
  fairValue = Math.max(fairValue, 500);
  fairValue = Math.round(fairValue / 50) * 50;

  // Private sale — realistic FB Marketplace / Craigslist price
  const privateSale = Math.round((fairValue * 0.85) / 50) * 50;

  // Trade-in — tight range $500-2,000, reflects real dealer economics
  let tradeIn;
  if (brand.avoidTrade) {
    tradeIn = 0;
  } else {
    const reconditioningEst =
      (batteryAdj < -400 ? 2000 : batteryAdj < 0 ? 800 : 200) +
      issueDeductions * 1.5 +
      500;

    const dealerResale = brand.base * depreciation * 0.88 + seatAdj;

    const dealerMinProfit = 2000;
    tradeIn = Math.max(dealerResale - reconditioningEst - dealerMinProfit, 500);
    tradeIn = Math.min(tradeIn, 2000);
    tradeIn = Math.round(tradeIn / 50) * 50;

    if (formData.condition === "poor") tradeIn = Math.min(tradeIn, 600);
    if (age > 12) tradeIn = Math.min(tradeIn, 1250);
    if (age > 15) tradeIn = Math.min(tradeIn, 1000);
    if (age > 20) tradeIn = Math.min(tradeIn, 750);
    if (age > 25) tradeIn = Math.min(tradeIn, 500);

    // Hard floor — $500 minimum on any accepted brand
    tradeIn = Math.max(tradeIn, 500);
  }

  return { fairValue, privateSale, tradeIn, avoidTrade: brand.avoidTrade, age };
}

// ─── COMPONENTS ───

const ChevronDown = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M4 6l4 4 4-4" />
  </svg>
);

const CartIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
    <rect x="4" y="12" width="24" height="10" rx="3" fill="#1a3a2a" />
    <rect x="6" y="8" width="14" height="6" rx="2" fill="#2d5a3f" />
    <circle cx="9" cy="25" r="3" fill="#1a3a2a" stroke="#0f2318" strokeWidth="1.5" />
    <circle cx="23" cy="25" r="3" fill="#1a3a2a" stroke="#0f2318" strokeWidth="1.5" />
    <rect x="20" y="10" width="6" height="8" rx="1" fill="#3a7a5a" opacity="0.5" />
  </svg>
);

function SelectField({ label, value, onChange, options, placeholder }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
        textTransform: "uppercase", color: "#7a8a7e", marginBottom: 6,
      }}>{label}</label>
      <div style={{ position: "relative" }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%", padding: "12px 36px 12px 14px", fontSize: 15, fontFamily: "'DM Sans', sans-serif",
            border: "2px solid #2a4a38", borderRadius: 10, background: "#0a1f14",
            color: value ? "#e8f0eb" : "#5a6a5e", appearance: "none", cursor: "pointer",
            outline: "none", transition: "border-color 0.2s",
          }}
          onFocus={(e) => e.target.style.borderColor = "#4a9a6a"}
          onBlur={(e) => e.target.style.borderColor = "#2a4a38"}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div style={{
          position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
          color: "#5a7a6a", pointerEvents: "none",
        }}>
          <ChevronDown />
        </div>
      </div>
    </div>
  );
}

function CheckboxGroup({ label, options, selected, onChange }) {
  const toggle = (val) => {
    if (selected.includes(val)) onChange(selected.filter((v) => v !== val));
    else onChange([...selected, val]);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
        textTransform: "uppercase", color: "#7a8a7e", marginBottom: 8,
      }}>{label}</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map((opt) => {
          const isActive = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => toggle(opt.value)}
              style={{
                padding: "8px 14px", fontSize: 13, fontFamily: "'DM Sans', sans-serif",
                border: `2px solid ${isActive ? "#4a9a6a" : "#2a4a38"}`,
                borderRadius: 8, cursor: "pointer", transition: "all 0.2s",
                background: isActive ? "#1a3a28" : "transparent",
                color: isActive ? "#8adfaa" : "#5a7a6a", fontWeight: isActive ? 600 : 400,
              }}
            >{opt.label}</button>
          );
        })}
      </div>
    </div>
  );
}

function PriceCard({ label, amount, subtitle, color, delay, visible }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${color}15, ${color}08)`,
      border: `2px solid ${color}40`,
      borderRadius: 14, padding: "20px 18px", textAlign: "center",
      transform: visible ? "translateY(0)" : "translateY(20px)",
      opacity: visible ? 1 : 0,
      transition: `all 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
        color: `${color}cc`, marginBottom: 8,
      }}>{label}</div>
      <div style={{
        fontSize: 32, fontWeight: 800, color: color,
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {amount === 0 ? "N/A" : `$${amount.toLocaleString()}`}
      </div>
      <div style={{ fontSize: 12, color: "#6a7a6e", marginTop: 6 }}>{subtitle}</div>
    </div>
  );
}

// ─── MAIN APP ───
export default function GolfCartBlueBook() {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    brand: "", year: "", condition: "", batteries: "", seats: "4", issues: [],
  });
  const [result, setResult] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const resultsRef = useRef(null);

  const update = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));

  const canProceed =
    step === 0 ? formData.brand && formData.year :
    step === 1 ? formData.condition && formData.batteries :
    true;

  const handleCalculate = () => {
    const res = calculateValue({ ...formData, year: parseInt(formData.year) });
    setResult(res);
    setStep(3);
    setTimeout(() => setShowResults(true), 100);
  };

  const handleReset = () => {
    setStep(0);
    setFormData({ brand: "", year: "", condition: "", batteries: "", seats: "4", issues: [] });
    setResult(null);
    setShowResults(false);
  };

  const currentYear = 2026;
  const years = Array.from({ length: 45 }, (_, i) => {
    const y = currentYear - i;
    return { value: String(y), label: String(y) };
  });

  return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(170deg, #060f0a 0%, #0a1a12 40%, #0d2018 100%)",
      fontFamily: "'DM Sans', sans-serif", color: "#d0e0d6",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;0,9..40,800;1,9..40,400&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        padding: "40px 20px 20px", textAlign: "center",
        borderBottom: "1px solid #1a2a20",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8 }}>
          <CartIcon />
          <h1 style={{
            fontSize: 24, fontFamily: "'Playfair Display', serif", fontWeight: 800,
            color: "#e8f4ed", margin: 0, letterSpacing: "-0.02em",
          }}>
            Cart Value
          </h1>
        </div>
        <p style={{ fontSize: 13, color: "#5a7a6a", margin: 0, fontWeight: 500 }}>
          Golf Cart Blue Book — Know Your Cart's Worth
        </p>
      </div>

      {/* Progress */}
      {step < 3 && (
        <div style={{ padding: "16px 24px 0", display: "flex", gap: 6 }}>
          {[0, 1, 2].map((s) => (
            <div key={s} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: s <= step ? "#4a9a6a" : "#1a2a20",
              transition: "background 0.4s",
            }} />
          ))}
        </div>
      )}

      <div style={{ padding: "20px 20px 40px", maxWidth: 480, margin: "0 auto" }}>

        {/* Step 0: Brand & Year */}
        {step === 0 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#c0d8ca", marginBottom: 20 }}>
              What's your cart?
            </h2>
            <SelectField
              label="Brand / Model"
              value={formData.brand}
              onChange={(v) => update("brand", v)}
              placeholder="Select brand..."
              options={Object.keys(BRANDS).map((b) => ({ value: b, label: b }))}
            />
            <SelectField
              label="Year"
              value={formData.year}
              onChange={(v) => update("year", v)}
              placeholder="Select year..."
              options={years}
            />
            <SelectField
              label="Seating"
              value={formData.seats}
              onChange={(v) => update("seats", v)}
              placeholder="Select..."
              options={[
                { value: "2", label: "2 Passenger" },
                { value: "4", label: "4 Passenger" },
                { value: "6", label: "6 Passenger" },
              ]}
            />
          </div>
        )}

        {/* Step 1: Condition */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#c0d8ca", marginBottom: 20 }}>
              What condition is it in?
            </h2>
            <SelectField
              label="Overall Condition"
              value={formData.condition}
              onChange={(v) => update("condition", v)}
              placeholder="Select condition..."
              options={[
                { value: "excellent", label: "Excellent — Like new, garage kept, minimal use" },
                { value: "good", label: "Good — Normal wear, everything works" },
                { value: "fair", label: "Fair — Visible wear, may need some work" },
                { value: "poor", label: "Poor — Significant issues, needs real work" },
              ]}
            />
            <SelectField
              label="Battery Status"
              value={formData.batteries}
              onChange={(v) => update("batteries", v)}
              placeholder="Select battery condition..."
              options={[
                { value: "new_lithium", label: "Lithium — New or recent conversion" },
                { value: "new_lead", label: "Lead Acid — Replaced in last 12 months" },
                { value: "good", label: "Lead Acid — 1-2 years old, holding charge" },
                { value: "aging", label: "Lead Acid — 3-4 years old, getting weak" },
                { value: "bad", label: "Lead Acid — 5+ years / dead / needs replacement" },
                { value: "unknown", label: "Unknown / Not sure" },
              ]}
            />
          </div>
        )}

        {/* Step 2: Issues */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#c0d8ca", marginBottom: 4 }}>
              Any known issues?
            </h2>
            <p style={{ fontSize: 13, color: "#5a7a6a", marginBottom: 20 }}>
              Select anything that needs repair or replacement. Skip if none.
            </p>
            <CheckboxGroup
              label="Known Issues (select all that apply)"
              selected={formData.issues}
              onChange={(v) => update("issues", v)}
              options={[
                { value: "tires", label: "Tires / Wheels" },
                { value: "seats", label: "Seats / Upholstery" },
                { value: "controller", label: "Controller" },
                { value: "motor", label: "Motor" },
                { value: "body", label: "Body / Cowl" },
                { value: "charger", label: "Charger" },
                { value: "brakes", label: "Brakes" },
                { value: "windshield", label: "Windshield / Top" },
              ]}
            />
          </div>
        )}

        {/* Navigation */}
        {step < 3 && (
          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                style={{
                  flex: 1, padding: "14px", fontSize: 15, fontWeight: 600,
                  fontFamily: "'DM Sans', sans-serif",
                  border: "2px solid #2a4a38", borderRadius: 12,
                  background: "transparent", color: "#7a9a8a", cursor: "pointer",
                }}
              >Back</button>
            )}
            <button
              onClick={() => step === 2 ? handleCalculate() : setStep(step + 1)}
              disabled={!canProceed}
              style={{
                flex: 2, padding: "14px", fontSize: 15, fontWeight: 700,
                fontFamily: "'DM Sans', sans-serif",
                border: "none", borderRadius: 12, cursor: canProceed ? "pointer" : "default",
                background: canProceed
                  ? "linear-gradient(135deg, #2a7a4a, #1a5a34)"
                  : "#1a2a20",
                color: canProceed ? "#fff" : "#3a4a3e",
                transition: "all 0.3s",
                boxShadow: canProceed ? "0 4px 20px #2a7a4a30" : "none",
              }}
            >
              {step === 2 ? "Get My Value" : "Continue"}
            </button>
          </div>
        )}

        {/* Results */}
        {step === 3 && result && (
          <div ref={resultsRef}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <h2 style={{
                fontSize: 20, fontWeight: 700, color: "#c0d8ca", marginBottom: 4,
                fontFamily: "'Playfair Display', serif",
              }}>
                Your Cart's Value
              </h2>
              <p style={{ fontSize: 13, color: "#5a7a6a", margin: 0 }}>
                {formData.year} {formData.brand} • {formData.condition} condition • {result.age} years old
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
              <PriceCard
                label="Fair Market Value"
                amount={result.fairValue}
                subtitle="What the cart is worth in a fair transaction"
                color="#4a9a6a"
                delay={0.1}
                visible={showResults}
              />
              <PriceCard
                label="Good Private Sale"
                amount={result.privateSale}
                subtitle="Realistic price on FB Marketplace or Craigslist"
                color="#5a8abf"
                delay={0.25}
                visible={showResults}
              />
              <PriceCard
                label="Dealer Trade-In"
                amount={result.tradeIn}
                subtitle={
                  result.avoidTrade
                    ? "Most dealers won't accept this brand on trade"
                    : "What a dealer would realistically offer"
                }
                color={result.avoidTrade ? "#8a5a5a" : "#bf8a4a"}
                delay={0.4}
                visible={showResults}
              />
            </div>

            {/* Why trade-in is low */}
            <div style={{
              background: "#0f1a14", border: "1px solid #1a2a20", borderRadius: 12,
              padding: 16, marginBottom: 20,
              opacity: showResults ? 1 : 0,
              transition: "opacity 0.5s ease 0.6s",
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
                textTransform: "uppercase", color: "#7a8a7e", marginBottom: 10,
              }}>Understanding Trade-In Value</div>
              <div style={{ fontSize: 13, color: "#8a9a8e", lineHeight: 1.6 }}>
                {result.avoidTrade ? (
                  <>This brand has limited resale demand and parts availability, which makes it difficult for most dealerships to accept on trade. You may have better luck selling privately.</>
                ) : (
                  <>Trade-in values reflect the significant investment a dealer makes before reselling. A full battery replacement and installation typically runs around $2,000 or more, and most trade-ins also need additional work — tires, seats, electrical components, and a full inspection and detail. It's not uncommon for a dealer to invest $3,000–$4,000+ getting a used cart floor-ready, which is why trade-in offers are considerably lower than private sale values.</>
                )}
              </div>
            </div>

            {/* Factors affecting value */}
            {(formData.issues.length > 0 || formData.batteries === "bad" || formData.batteries === "aging") && (
              <div style={{
                background: "#0f1a14", border: "1px solid #1a2a20", borderRadius: 12,
                padding: 16, marginBottom: 20,
                opacity: showResults ? 1 : 0, transition: "opacity 0.5s ease 0.7s",
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
                  textTransform: "uppercase", color: "#7a8a7e", marginBottom: 10,
                }}>Factors Affecting Your Value</div>
                {(formData.batteries === "bad" || formData.batteries === "aging") && (
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 0", borderBottom: "1px solid #1a2a20", fontSize: 13,
                  }}>
                    <span style={{ color: "#8a9a8e" }}>Battery condition</span>
                    <span style={{ color: "#bf6a4a", fontWeight: 600, fontSize: 12 }}>
                      {formData.batteries === "bad" ? "Needs replacement (~$2,000+)" : "Aging — may need replacement soon"}
                    </span>
                  </div>
                )}
                {formData.issues.map((issue) => {
                  const issueLabels = {
                    tires: "Tires & wheels need attention",
                    seats: "Seats / upholstery worn",
                    controller: "Controller issues",
                    motor: "Motor issues",
                    body: "Body / cosmetic damage",
                    charger: "Charger needs replacement",
                    brakes: "Brakes need service",
                    windshield: "Windshield damaged / missing",
                  };
                  return (
                    <div key={issue} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 0", borderBottom: "1px solid #1a2a20", fontSize: 13,
                    }}>
                      <span style={{ color: "#8a9a8e" }}>{issueLabels[issue] || issue}</span>
                      <span style={{ color: "#bf6a4a", fontWeight: 600, fontSize: 12 }}>Reduces value</span>
                    </div>
                  );
                })}
                <div style={{ fontSize: 12, color: "#5a6a5e", marginTop: 10, lineHeight: 1.5 }}>
                  Each issue represents repair work that a buyer or dealer will need to invest in. This is factored into all three price estimates above.
                </div>
              </div>
            )}

            <button
              onClick={() => {
                const subject = `Cart Value Report: ${formData.year} ${formData.brand}`;
                const body = [
                  `CART VALUE REPORT`,
                  `─────────────────────────`,
                  ``,
                  `${formData.year} ${formData.brand}`,
                  `Condition: ${formData.condition.charAt(0).toUpperCase() + formData.condition.slice(1)}`,
                  `Seating: ${formData.seats} Passenger`,
                  `Battery Status: ${
                    formData.batteries === "new_lithium" ? "Lithium (New/Recent)" :
                    formData.batteries === "new_lead" ? "Lead Acid (Replaced recently)" :
                    formData.batteries === "good" ? "Lead Acid (1-2 yrs, good)" :
                    formData.batteries === "aging" ? "Lead Acid (3-4 yrs, aging)" :
                    formData.batteries === "bad" ? "Lead Acid (Needs replacement)" :
                    "Unknown"
                  }`,
                  formData.issues.length > 0 ? `Known Issues: ${formData.issues.join(", ")}` : ``,
                  ``,
                  `─────────────────────────`,
                  `ESTIMATED VALUES`,
                  `─────────────────────────`,
                  ``,
                  `Fair Market Value:  $${result.fairValue.toLocaleString()}`,
                  `Good Private Sale:  $${result.privateSale.toLocaleString()}`,
                  result.avoidTrade
                    ? `Dealer Trade-In:    N/A (limited dealer demand for this brand)`
                    : `Dealer Trade-In:    $${result.tradeIn.toLocaleString()}`,
                  ``,
                  `─────────────────────────`,
                  ``,
                  `Note: Values are estimates based on NW Florida market data.`,
                  `Actual prices may vary based on local demand and cart history.`,
                  ``,
                  `Powered by Cart Value — Golf Cart Blue Book`,
                ].filter(Boolean).join("\n");
                window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
              }}
              style={{
                width: "100%", padding: "14px", fontSize: 15, fontWeight: 700,
                fontFamily: "'DM Sans', sans-serif",
                border: "none", borderRadius: 12,
                background: "linear-gradient(135deg, #2a5a7a, #1a3a5a)",
                color: "#fff", cursor: "pointer",
                opacity: showResults ? 1 : 0, transition: "opacity 0.5s ease 0.75s",
                boxShadow: "0 4px 20px #2a5a7a30",
                marginBottom: 10,
              }}
            >
              Email This Report
            </button>

            <button
              onClick={handleReset}
              style={{
                width: "100%", padding: "14px", fontSize: 15, fontWeight: 700,
                fontFamily: "'DM Sans', sans-serif",
                border: "2px solid #2a4a38", borderRadius: 12,
                background: "transparent", color: "#7a9a8a", cursor: "pointer",
                opacity: showResults ? 1 : 0, transition: "opacity 0.5s ease 0.8s",
              }}
            >
              Value Another Cart
            </button>

            <p style={{
              textAlign: "center", fontSize: 11, color: "#3a4a3e", marginTop: 20, lineHeight: 1.5,
              opacity: showResults ? 1 : 0, transition: "opacity 0.5s ease 0.9s",
            }}>
              Values are estimates based on NW Florida market data.
              <br />Actual prices may vary based on local demand and specific cart history.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}