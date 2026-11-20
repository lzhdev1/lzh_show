import type { Metadata } from "next";
import { ArrowUpRight, Award, BookOpen, Mail, MapPin } from "lucide-react";
import { getMessages, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import "./about.css";

const email = "lzh2411829@gmail.com";
type AboutCopy = (typeof import("@/messages/zh.json"))["About"];
type Props = { params: Promise<{ locale: string }> };

async function getProfile(locale: string) {
  const messages = await getMessages({ locale });
  return messages.About as AboutCopy;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const profile = await getProfile(locale);
  return { title: `${profile.title} · ${profile.name}`, description: profile.intro };
}

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const profile = await getProfile(locale);
  const contents = [
    ["education", profile.educationTitle],
    ["experience", profile.experienceTitle],
    ["skills", profile.skillsTitle],
    ["honors", profile.honorsTitle],
    ["personal", profile.personalTitle],
  ];

  return (
    <div className="about-page">
      <div className="about-frame">
        <div className="about-intro">
          <header className="about-identity">
            <p className="about-label">{profile.title}</p>
            <h1>{profile.name}</h1>
            <p className="about-role">{profile.role}</p>
            <p className="about-bio">{profile.intro}</p>
            <div className="about-actions">
              <a className="about-email" href={`mailto:${email}`}>
                <Mail size={17} aria-hidden="true" /><span className="sr-only">{profile.contactLabel} </span>{email}
              </a>
              <Link className="about-project-link" href="/projects">
                {profile.projectsLabel}<ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </header>
          <section id="education" className="about-education" aria-labelledby="education-title">
            <h2 id="education-title"><BookOpen size={18} aria-hidden="true" />{profile.educationTitle}</h2>
            <ul>
              {profile.education.map((study) => (
                <li key={study.school}>
                  <h3>{study.school}</h3>
                  <p>{study.field}<span aria-hidden="true"> · </span>{study.degree}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="about-details">
          <aside>
            <nav className="about-contents" aria-labelledby="contents-title">
              <h2 id="contents-title">{profile.contentsLabel}</h2>
              <ul>{contents.map(([id, label]) => (
                <li key={id}><Link href={`/about#${id}`}>{label}</Link></li>
              ))}</ul>
            </nav>
          </aside>
          <div className="about-sections">
            <section id="experience" aria-labelledby="experience-title">
              <h2 id="experience-title">{profile.experienceTitle}</h2>
              <ol className="about-jobs">
                {profile.experience.map((job) => (
                  <li key={job.company} className="about-job">
                    <div className="about-job-meta">
                      <span className="about-period">{job.period}</span>
                      <span className="about-place"><MapPin size={13} aria-hidden="true" />{job.location}</span>
                    </div>
                    <h3>{job.company}</h3>
                    <p className="about-job-role">{job.role}</p>
                    {job.products.length > 0 && (
                      <div className="about-products">
                        <span>{profile.productsLabel}</span>
                        <ul>{job.products.map((product) => <li key={product}>{product}</li>)}</ul>
                      </div>
                    )}
                    <ul className="about-contributions">
                      {job.points.map((point) => <li key={point}>{point}</li>)}
                    </ul>
                  </li>
                ))}
              </ol>
            </section>

            <section id="skills" aria-labelledby="skills-title">
              <h2 id="skills-title">{profile.skillsTitle}</h2>
              <dl className="about-skills">
                {profile.skills.map((skill) => (
                  <div key={skill.name}>
                    <dt>{skill.name}</dt>
                    <dd>{skill.description}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section id="honors" aria-labelledby="honors-title">
              <h2 id="honors-title">{profile.honorsTitle}</h2>
              <ul className="about-honors">
                {profile.honors.map((honor) => (
                  <li key={honor}><Award size={18} aria-hidden="true" />{honor}</li>
                ))}
              </ul>
            </section>

            <section id="personal" aria-labelledby="personal-title">
              <h2 id="personal-title">{profile.personalTitle}</h2>
              <div className="about-personal">
                {profile.personal.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
              <dl className="about-interests">
                <dt>{profile.interestsLabel}</dt>
                <dd><ul>{profile.interests.map((interest) => <li key={interest}>{interest}</li>)}</ul></dd>
              </dl>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
