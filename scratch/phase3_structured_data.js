const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

// Helper to inject JSON-LD script block before </head>
function injectJsonLd(filePath, jsonLdObj) {
  const full = path.join(ROOT_DIR, filePath);
  let content = fs.readFileSync(full, 'utf8');

  // Check if json-ld already exists in file
  if (content.includes('application/ld+json')) {
    console.log(`Skipping ${filePath}: already has JSON-LD`);
    return false;
  }

  const jsonString = JSON.stringify(jsonLdObj, null, 2);
  const scriptBlock = `  <script type="application/ld+json">\n${jsonString}\n  </script>\n</head>`;

  content = content.replace(/<\/head>/i, scriptBlock);
  fs.writeFileSync(full, content, 'utf8');
  console.log(`Injected JSON-LD into ${filePath}`);
  return true;
}

// 1. solutions.html (Solutions Hub)
injectJsonLd('solutions.html', {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": "https://vyomantratech.com/solutions#collectionpage",
      "url": "https://vyomantratech.com/solutions",
      "name": "Technology Solutions | Vyomantra Technologies",
      "description": "Explore custom software, enterprise ERP, CRM, AI workflows, SaaS architecture and high-conversion e-commerce solutions from Vyomantra Technologies.",
      "isPartOf": {
        "@id": "https://vyomantratech.com/#website"
      },
      "publisher": {
        "@id": "https://vyomantratech.com/#organization"
      }
    },
    {
      "@type": "ItemList",
      "@id": "https://vyomantratech.com/solutions#itemlist",
      "name": "Vyomantra Enterprise Solutions",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Business Websites",
          "item": "https://vyomantratech.com/solutions/business-websites"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Custom Software",
          "item": "https://vyomantratech.com/solutions/custom-software"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": "Enterprise ERP & CRM",
          "item": "https://vyomantratech.com/solutions/erp-crm"
        },
        {
          "@type": "ListItem",
          "position": 4,
          "name": "Enterprise AI Solutions",
          "item": "https://vyomantratech.com/solutions/ai-solutions"
        },
        {
          "@type": "ListItem",
          "position": 5,
          "name": "Workflow Automation",
          "item": "https://vyomantratech.com/solutions/automation"
        },
        {
          "@type": "ListItem",
          "position": 6,
          "name": "SaaS Product Engineering",
          "item": "https://vyomantratech.com/solutions/saas"
        },
        {
          "@type": "ListItem",
          "position": 7,
          "name": "High-Conversion E-commerce",
          "item": "https://vyomantratech.com/solutions/ecommerce"
        }
      ]
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://vyomantratech.com/solutions#breadcrumb",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://vyomantratech.com/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Solutions",
          "item": "https://vyomantratech.com/solutions"
        }
      ]
    }
  ]
});

// 2. 7 Solution Detail Pages
const solutionsDetailData = [
  {
    file: 'solutions/ai-solutions.html',
    slug: 'ai-solutions',
    name: 'Enterprise AI Solutions & Intelligent Systems',
    serviceType: 'Artificial Intelligence & Machine Learning Integration',
    desc: 'Custom enterprise AI solutions, autonomous agent workflows, and intelligent decision systems engineered by Vyomantra Technologies.'
  },
  {
    file: 'solutions/automation.html',
    slug: 'automation',
    name: 'Workflow Automation Solutions',
    serviceType: 'Business Process & Workflow Automation',
    desc: 'End-to-end workflow automation and robotic operational pipelines engineered to eliminate repetitive business tasks.'
  },
  {
    file: 'solutions/business-websites.html',
    slug: 'business-websites',
    name: 'Corporate & Business Websites Solution',
    serviceType: 'High-Performance Corporate Web Platforms',
    desc: 'High-performance, secure business and corporate websites built to establish market authority and generate verified inquiries.'
  },
  {
    file: 'solutions/custom-software.html',
    slug: 'custom-software',
    name: 'Custom Software Solutions',
    serviceType: 'Bespoke Enterprise Software Engineering',
    desc: 'Bespoke enterprise software applications engineered to match exact business workflows and scale seamlessly.'
  },
  {
    file: 'solutions/ecommerce.html',
    slug: 'ecommerce',
    name: 'High-Conversion E-commerce Solutions',
    serviceType: 'Digital Commerce & Payment Platforms',
    desc: 'Custom e-commerce architectures engineered for speed, secure checkout counters, inventory sync, and high conversion velocity.'
  },
  {
    file: 'solutions/erp-crm.html',
    slug: 'erp-crm',
    name: 'Enterprise ERP & CRM Solutions',
    serviceType: 'Operational Resource Planning & Lead Systems',
    desc: 'Centralized ERP and CRM management systems providing total operational visibility, sales tracking, and multi-department controls.'
  },
  {
    file: 'solutions/saas.html',
    slug: 'saas',
    name: 'SaaS Product Engineering Solutions',
    serviceType: 'Multi-Tenant Cloud Software Engineering',
    desc: 'Full-lifecycle SaaS product architecture, multi-tenant database design, billing subscriptions, and cloud scalability.'
  }
];

solutionsDetailData.forEach(s => {
  injectJsonLd(s.file, {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `https://vyomantratech.com/solutions/${s.slug}#service`,
        "url": `https://vyomantratech.com/solutions/${s.slug}`,
        "name": s.name,
        "serviceType": s.serviceType,
        "description": s.desc,
        "provider": {
          "@id": "https://vyomantratech.com/#organization"
        },
        "areaServed": [
          "Dharmapuri",
          "Tamil Nadu",
          "India"
        ]
      },
      {
        "@type": "BreadcrumbList",
        "@id": `https://vyomantratech.com/solutions/${s.slug}#breadcrumb`,
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "https://vyomantratech.com/"
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Solutions",
            "item": "https://vyomantratech.com/solutions"
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": s.name,
            "item": `https://vyomantratech.com/solutions/${s.slug}`
          }
        ]
      }
    ]
  });
});

// 3. products.html (Products Hub)
injectJsonLd('products.html', {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": "https://vyomantratech.com/products#collectionpage",
      "url": "https://vyomantratech.com/products",
      "name": "Software Products | Vyomantra Technologies",
      "description": "Discover proprietary digital products and operational platforms built by Vyomantra Technologies, including StockMitra inventory software.",
      "isPartOf": {
        "@id": "https://vyomantratech.com/#website"
      },
      "publisher": {
        "@id": "https://vyomantratech.com/#organization"
      }
    },
    {
      "@type": "ItemList",
      "@id": "https://vyomantratech.com/products#itemlist",
      "name": "Vyomantra Products",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "StockMitra Inventory & POS Billing",
          "item": "https://vyomantratech.com/products/stockmitra"
        }
      ]
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://vyomantratech.com/products#breadcrumb",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://vyomantratech.com/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Products",
          "item": "https://vyomantratech.com/products"
        }
      ]
    }
  ]
});

// 4. products/stockmitra.html
injectJsonLd('products/stockmitra.html', {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": "https://vyomantratech.com/products/stockmitra#software",
      "url": "https://vyomantratech.com/products/stockmitra",
      "name": "StockMitra",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web, Windows, Cloud",
      "description": "StockMitra is an inventory management and barcode POS billing platform supporting rapid retail checkout, GST invoicing, and multi-branch tracking.",
      "author": {
        "@id": "https://vyomantratech.com/#organization"
      },
      "publisher": {
        "@id": "https://vyomantratech.com/#organization"
      }
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://vyomantratech.com/products/stockmitra#breadcrumb",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://vyomantratech.com/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Products",
          "item": "https://vyomantratech.com/products"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": "StockMitra",
          "item": "https://vyomantratech.com/products/stockmitra"
        }
      ]
    }
  ]
});

// 5. portfolio.html (Portfolio Hub)
injectJsonLd('portfolio.html', {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": "https://vyomantratech.com/portfolio#collectionpage",
      "url": "https://vyomantratech.com/portfolio",
      "name": "Client Portfolio & Case Studies | Vyomantra Technologies",
      "description": "Review client case studies and selected software architectures delivered by Vyomantra Technologies across web applications, AI-CRM and digital commerce.",
      "isPartOf": {
        "@id": "https://vyomantratech.com/#website"
      },
      "publisher": {
        "@id": "https://vyomantratech.com/#organization"
      }
    },
    {
      "@type": "ItemList",
      "@id": "https://vyomantratech.com/portfolio#itemlist",
      "name": "Featured Case Studies",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "AI-CRM Enterprise System",
          "item": "https://vyomantratech.com/portfolio/ai-crm"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Home Bakers Online Store",
          "item": "https://vyomantratech.com/portfolio/home-bakers"
        }
      ]
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://vyomantratech.com/portfolio#breadcrumb",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://vyomantratech.com/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Portfolio",
          "item": "https://vyomantratech.com/portfolio"
        }
      ]
    }
  ]
});

// 6. Case Study Detail Pages
injectJsonLd('portfolio/ai-crm.html', {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CreativeWork",
      "@id": "https://vyomantratech.com/portfolio/ai-crm#case-study",
      "url": "https://vyomantratech.com/portfolio/ai-crm",
      "headline": "AI-CRM Enterprise Case Study",
      "name": "AI-CRM Enterprise System",
      "description": "Case study on how Vyomantra Technologies engineered an intelligent AI-CRM platform to centralize lead intake, automate follow-ups, and accelerate deal velocity.",
      "author": {
        "@id": "https://vyomantratech.com/#organization"
      },
      "publisher": {
        "@id": "https://vyomantratech.com/#organization"
      }
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://vyomantratech.com/portfolio/ai-crm#breadcrumb",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://vyomantratech.com/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Portfolio",
          "item": "https://vyomantratech.com/portfolio"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": "AI-CRM Enterprise Case Study",
          "item": "https://vyomantratech.com/portfolio/ai-crm"
        }
      ]
    }
  ]
});

injectJsonLd('portfolio/home-bakers.html', {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CreativeWork",
      "@id": "https://vyomantratech.com/portfolio/home-bakers#case-study",
      "url": "https://vyomantratech.com/portfolio/home-bakers",
      "headline": "Home Bakers E-Commerce Case Study",
      "name": "Home Bakers Online Store",
      "description": "Case study on how Vyomantra Technologies designed and developed a high-conversion artisanal bakery e-commerce platform with automated order notifications.",
      "author": {
        "@id": "https://vyomantratech.com/#organization"
      },
      "publisher": {
        "@id": "https://vyomantratech.com/#organization"
      }
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://vyomantratech.com/portfolio/home-bakers#breadcrumb",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://vyomantratech.com/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Portfolio",
          "item": "https://vyomantratech.com/portfolio"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": "Home Bakers Case Study",
          "item": "https://vyomantratech.com/portfolio/home-bakers"
        }
      ]
    }
  ]
});

// 7. gallery.html
injectJsonLd('gallery.html', {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ImageGallery",
      "@id": "https://vyomantratech.com/gallery#gallery",
      "url": "https://vyomantratech.com/gallery",
      "name": "Company Gallery & Milestones | Vyomantra Technologies",
      "description": "Snapshots from technical bootcamps, client partnerships, developer hackathons, and team milestones at Vyomantra Technologies in Dharmapuri, Tamil Nadu.",
      "isPartOf": {
        "@id": "https://vyomantratech.com/#website"
      },
      "publisher": {
        "@id": "https://vyomantratech.com/#organization"
      }
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://vyomantratech.com/gallery#breadcrumb",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://vyomantratech.com/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Gallery",
          "item": "https://vyomantratech.com/gallery"
        }
      ]
    }
  ]
});

// 8. request-a-quote.html
injectJsonLd('request-a-quote.html', {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ContactPage",
      "@id": "https://vyomantratech.com/request-a-quote#quotepage",
      "url": "https://vyomantratech.com/request-a-quote",
      "name": "Request a Project Quote | Vyomantra Technologies",
      "description": "Request a project quote and technical engineering proposal for custom software, web platforms, mobile apps, or enterprise AI from Vyomantra Technologies.",
      "isPartOf": {
        "@id": "https://vyomantratech.com/#website"
      },
      "about": {
        "@id": "https://vyomantratech.com/#organization"
      }
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://vyomantratech.com/request-a-quote#breadcrumb",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://vyomantratech.com/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Request a Quote",
          "item": "https://vyomantratech.com/request-a-quote"
        }
      ]
    }
  ]
});

// 9. Legal Pages
const legalData = [
  {
    file: 'privacy.html',
    slug: 'privacy',
    name: 'Privacy Policy | Vyomantra Technologies',
    desc: 'Review the Vyomantra Technologies privacy policy detailing data protection, collection, storage and user security across our platforms.'
  },
  {
    file: 'terms.html',
    slug: 'terms',
    name: 'Terms of Use | Vyomantra Technologies',
    desc: 'Review terms and conditions for Vyomantra Technologies website usage, engineering deliverables, software licensing and customer obligations.'
  },
  {
    file: 'refund-policy.html',
    slug: 'refund-policy',
    name: 'Cancellation & Refund Policy | Vyomantra Technologies',
    desc: 'Read the official cancellation and refund policy governing software project milestones, consulting services, and student training at Vyomantra Technologies.'
  }
];

legalData.forEach(l => {
  injectJsonLd(l.file, {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `https://vyomantratech.com/${l.slug}#webpage`,
        "url": `https://vyomantratech.com/${l.slug}`,
        "name": l.name,
        "description": l.desc,
        "isPartOf": {
          "@id": "https://vyomantratech.com/#website"
        },
        "publisher": {
          "@id": "https://vyomantratech.com/#organization"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": `https://vyomantratech.com/${l.slug}#breadcrumb`,
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "https://vyomantratech.com/"
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": l.name.split('|')[0].trim(),
            "item": `https://vyomantratech.com/${l.slug}`
          }
        ]
      }
    ]
  });
});

console.log('Phase 3 structured data expansion completed.');
