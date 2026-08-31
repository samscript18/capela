import { ImageResponse } from "next/og";

export const alt = "Capela — Investigate a molecule and see what the scientific evidence supports";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const sage = "#aebc8d";
const green = "#63e6a1";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          overflow: "hidden",
          padding: "58px 64px 52px",
          background: "#070907",
          color: "#f7f9ef",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 610,
            height: 610,
            right: -210,
            top: -260,
            borderRadius: 999,
            background: "radial-gradient(circle, rgba(159,173,124,.22) 0%, rgba(7,9,7,0) 68%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 460,
            height: 460,
            left: -230,
            bottom: -330,
            borderRadius: 999,
            background: "radial-gradient(circle, rgba(99,230,161,.13) 0%, rgba(7,9,7,0) 70%)",
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 18,
                border: "1px solid rgba(174,188,141,.28)",
                background: "rgba(159,173,124,.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="34" height="34" viewBox="0 0 36 36" fill="none">
                <path d="M8 24.5 15.2 8l12.5 5.2-4.1 14.6L8 24.5Z" stroke={sage} strokeWidth="1.15" />
                <path d="m15.2 8 8.4 19.8M27.7 13.2 8 24.5" stroke={sage} strokeOpacity=".42" strokeWidth=".8" />
                <circle cx="15.2" cy="8" r="2.2" fill={sage} />
                <circle cx="27.7" cy="13.2" r="1.8" fill={green} />
                <circle cx="23.6" cy="27.8" r="2" fill={sage} />
                <circle cx="8" cy="24.5" r="1.5" fill="#f7f9ef" />
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 29, fontWeight: 700, letterSpacing: "-1.2px" }}>
                Capela<span style={{ color: sage }}>°</span>
              </div>
              <div style={{ display: "flex", marginTop: 3, color: "#7f897c", fontSize: 12, letterSpacing: "1.4px" }}>
                SCIENTIFIC INTELLIGENCE
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "10px 16px",
              border: "1px solid rgba(174,188,141,.18)",
              borderRadius: 999,
              color: "#aab3a6",
              background: "rgba(255,255,255,.025)",
              fontSize: 12,
              letterSpacing: ".9px",
            }}
          >
            <span style={{ display: "flex", width: 7, height: 7, borderRadius: 999, background: green }} />
            AI MOLECULE INVESTIGATION AGENT
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 56 }}>
          <div style={{ display: "flex", flexDirection: "column", width: 690 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: 58,
                fontWeight: 600,
                letterSpacing: "-3.6px",
                lineHeight: 0.98,
              }}
            >
              <span>Investigate a molecule.</span>
              <div style={{ display: "flex", color: "#a6aea2", marginTop: 10, whiteSpace: "nowrap" }}>
                <span>See what the&nbsp;</span>
                <span style={{ color: sage }}>evidence</span>
              </div>
              <span style={{ color: "#a6aea2" }}>supports.</span>
            </div>
            <div
              style={{ display: "flex", marginTop: 24, maxWidth: 650, color: "#8d968a", fontSize: 18, lineHeight: 1.5 }}
            >
              Sourced scientific literature, evidence-graded findings, molecular targets, mechanisms, and visible
              research gaps.
            </div>
          </div>

          <div
            style={{
              width: 328,
              display: "flex",
              flexDirection: "column",
              padding: "25px 26px",
              border: "1px solid rgba(174,188,141,.17)",
              borderRadius: 28,
              background: "linear-gradient(145deg, rgba(26,31,24,.98), rgba(11,14,11,.98))",
              boxShadow: "0 28px 70px rgba(0,0,0,.35)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ display: "flex", color: sage, fontSize: 11, letterSpacing: "1.5px" }}>
                EXAMPLE DOSSIER
              </span>
              <span style={{ display: "flex", color: green, fontSize: 11 }}>● COMPLETE</span>
            </div>
            <div style={{ display: "flex", marginTop: 24, fontSize: 28, fontWeight: 600 }}>Loliolide</div>
            <div style={{ display: "flex", marginTop: 8, color: "#778174", fontSize: 13 }}>Evidence assessment</div>
            <div style={{ display: "flex", marginTop: 25, gap: 9 }}>
              <Metric value="12" label="STUDIES" />
              <Metric value="8" label="FINDINGS" />
              <Metric value="3" label="TARGETS" />
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 20,
                paddingTop: 18,
                borderTop: "1px solid rgba(255,255,255,.08)",
                color: "#aeb6aa",
                fontSize: 13,
              }}
            >
              Experimental and computational evidence remain visibly distinct.
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(255,255,255,.07)",
            paddingTop: 20,
          }}
        >
          <div style={{ display: "flex", gap: 10 }}>
            {["RESOLVE", "SEARCH", "EXTRACT", "CLASSIFY", "ASSESS"].map((item, index) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  color: "#687165",
                  fontSize: 10,
                  letterSpacing: "1.2px",
                }}
              >
                <span>{item}</span>
                {index < 4 && <span style={{ color: "rgba(174,188,141,.35)" }}>→</span>}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", color: sage, fontSize: 12, fontWeight: 600 }}>EVIDENCE BEFORE CONCLUSION.</div>
        </div>
      </div>
    ),
    size,
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: "12px 10px",
        borderRadius: 15,
        border: "1px solid rgba(255,255,255,.07)",
        background: "rgba(0,0,0,.2)",
      }}
    >
      <span style={{ fontSize: 22, color: "#eef2df", fontWeight: 600 }}>{value}</span>
      <span style={{ marginTop: 4, color: "#697267", fontSize: 8, letterSpacing: "1px" }}>{label}</span>
    </div>
  );
}
