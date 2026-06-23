export default function StartSessionPage() {
    return (
      <main
        style={{
          minHeight: "100vh",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at center, #f8fafc 0%, #eeeeee 45%, #d6d6d6 100%)",
          padding: "24px",
        }}
      >
        <section
          style={{
            width: "360px",
            borderRadius: "16px",
            overflow: "hidden",
            background: "rgba(255,255,255,0.92)",
            border: "1px solid #b9c6ff",
            boxShadow:
              "0 24px 70px rgba(37, 99, 235, 0.22), -28px 0 70px rgba(34, 197, 94, 0.16)",
          }}
        >
          <div
            style={{
              padding: "30px 28px 24px",
              textAlign: "center",
              background: "#f8fbff",
            }}
          >
            <h1
              style={{
                fontSize: "15px",
                lineHeight: "22px",
                fontWeight: 700,
                color: "#111827",
                margin: 0,
              }}
            >
              "Hey Medexa, start a new session
              <br />
              with Samuel Thompson "
            </h1>
  
            <div
              style={{
                marginTop: "26px",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: "76px",
                  height: "76px",
                  borderRadius: "999px",
                  border: "1px solid rgba(37,99,235,0.55)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "999px",
                    border: "1px solid rgba(37,99,235,0.55)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "999px",
                      border: "2px solid #4f63ff",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
  
          <div
            style={{
              padding: "28px",
              textAlign: "center",
              background: "#ffffff",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "15px",
                fontWeight: 500,
                color: "#111827",
              }}
            >
              Starting the Session...
            </p>
  
            <p
              style={{
                margin: "18px 0 0",
                fontSize: "13px",
                fontWeight: 500,
                color: "#111827",
              }}
            >
              Syncing Patient Context...
            </p>
          </div>
        </section>
      </main>
    );
  }