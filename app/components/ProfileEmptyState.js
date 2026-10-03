'use client';

import './profile-empty.css';

export default function ProfileEmptyState({ icon: Icon, title, description, action, name }) {
  return <div className="profile-empty" data-empty={name}><div className="profile-empty-icon" aria-hidden="true"><Icon size={22} /></div><div className="profile-empty-copy"><h3>{title}</h3><p>{description}</p></div>{action && <div className="profile-empty-actions">{action}</div>}</div>;
}
