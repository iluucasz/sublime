import logo from "@/assets/sublime-logo.png";

export const Logo = ({ className = "h-12" }: { className?: string }) => (
  <img src={logo} alt="Sublime" className={className} />
);
