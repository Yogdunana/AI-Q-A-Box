import { useLocation, useNavigate, useParams } from "react-router";
import { QuestionDetail } from "./QuestionDetail";
import styles from "./QuestionPage.module.css";

export function QuestionPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const back = () => navigate(from ?? "/app/inbox");

  return (
    <div className={styles.page}>
      <QuestionDetail key={id} id={id} variant="page" onBack={back} onRemoved={back} />
    </div>
  );
}
