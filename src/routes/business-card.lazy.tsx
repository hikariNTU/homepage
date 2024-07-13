import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createLazyFileRoute } from "@tanstack/react-router";
import dom2Image from "dom-to-image";
import { Loader2Icon } from "lucide-react";
import { Checkbox } from "@radix-ui/react-checkbox";
import "@google/model-viewer";
import cardModel from "@/assets/model/business-card-base.glb?url";
import { ModelViewerElement } from "@google/model-viewer";

import styleData from "@/styles/business-card.scss?inline";

function useStyleData() {
  const id = "business-card-styles";
  useLayoutEffect(() => {
    const styleTag = document.createElement("style");
    styleTag.id = id;
    styleTag.innerHTML = styleData;

    document.head.appendChild(styleTag);

    return () => {
      document.getElementById(id)?.remove();
    };
  });
}

export const Route = createLazyFileRoute("/business-card")({
  component: () => <EntryPage />,
});

const Header = () => {
  const chips = [
    "Business Card",
    "Minimal Design",
    "3D Model",
    "Printable Content",
    "And more...",
  ];
  return (
    <header>
      <div className="header-wrapper">
        <h1>Business Card Example</h1>
        <p className="landmark" role="banner">
          Try this business card. It won't hurt.
        </p>
        <div className="m-2 flex flex-wrap items-center justify-center gap-2 text-xs">
          {chips.map((v) => (
            <div
              key={`c-${v}`}
              className="inline rounded-full border px-2 py-1"
            >
              {v}
            </div>
          ))}
        </div>
      </div>
    </header>
  );
};

const EntryPage = () => {
  useStyleData();
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardImg, setCardImage] = useState("");
  const [updater, setUpdater] = useState(0);
  const [updating, setUpdating] = useState(true);
  const [showForm, setShowForm] = useState(true);
  const [urlParsed, setUrlParsed] = useState(false);
  const [sharingUrl, setSharingUrl] = useState("");
  const [scale] = useState(2.0);

  const [imageSize, setImageSize] = useState(1024);
  const [name, setName] = useState("金乘五");
  const [engName, setEngName] = useState("Mutif, King");
  const [position, setPosition] = useState("資深副總督\n設計人");
  const [engPosition, setEngPosition] = useState(
    "Gun-Tank,\nGolden Wind Experience Squad",
  );
  const [company, setCompany] = useState("清英社馬企業有限公司");
  const [engCompany, setEngCompany] = useState("WASD Co. Ltd.");
  const [address, setAddress] = useState(
    "台北市南港區研究院路二段 00 號 \n比較大樓 104E",
  );
  const [additional, setAdditional] = useState(
    [
      "user@example.com",
      "Tel: (01) 2345-6789",
      "Fax: (09) 8765-4321#0909",
      "M: +81-234-567-890",
      "統一編號：01234567",
    ].join("\n"),
  );
  const packParams = {
    name,
    engName,
    position,
    engPosition,
    company,
    engCompany,
    address,
    additional,
  };

  const formData = {
    "Basic Information": {
      Name: {
        value: name,
        handle: setName,
      },
      "English Name": {
        value: engName,
        handle: setEngName,
      },
      Position: {
        value: position,
        handle: setPosition,
        multiline: true,
      },
      "English Position": {
        value: engPosition,
        handle: setEngPosition,
        multiline: true,
      },
    },
    "Detail Information": {
      Company: {
        value: company,
        handle: setCompany,
        multiline: true,
      },
      "English Company": {
        value: engCompany,
        handle: setEngCompany,
        multiline: true,
      },
      Address: {
        value: address,
        handle: setAddress,
        multiline: true,
      },
      Additional: {
        value: additional,
        handle: setAdditional,
        multiline: true,
      },
    },
  };
  const handleUpdateImageClick = () => {
    setUpdater((pre) => pre + 1);
  };

  // Update Image Data using "Dom 2 Image"
  useEffect(() => {
    setUpdating(true);
    const callback = setTimeout(() => {
      if (!cardRef.current) {
        return;
      }
      const targetWidth = imageSize;
      const w = cardRef.current.offsetWidth;
      const h = cardRef.current.offsetHeight;
      const scale = targetWidth / w;

      dom2Image
        .toPng(cardRef.current, {
          width: w * scale,
          height: h * scale,
          bgcolor: "white",
          style: {
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          },
        })
        .then(async function (dataUrl) {
          const card = document.querySelector(
            "model-viewer#card-model",
          ) as ModelViewerElement;
          const material = card?.model?.materials[0];
          if (material?.pbrMetallicRoughness["baseColorTexture"].texture) {
            material.pbrMetallicRoughness["baseColorTexture"].setTexture(
              await card.createTexture(dataUrl),
            );

            material.pbrMetallicRoughness["baseColorTexture"].texture?.source
              .uri;
          } else {
            console.error("Model material not found!!");
          }
          setCardImage(dataUrl);
        })
        .catch(function (error) {
          console.error("oops, something went wrong!", error);
        })
        .finally(() => {
          setUpdating(false);
        });
    }, 100);
    return () => clearTimeout(callback);
  }, [cardRef, updater, imageSize, setUpdating]);

  // Update URL search into state on first load
  useEffect(() => {
    const params = new URLSearchParams(window.location.toString());
    Object.entries({
      name: setName,
      engName: setEngName,
      position: setPosition,
      engPosition: setEngPosition,
      company: setCompany,
      engCompany: setEngCompany,
      address: setAddress,
      additional: setAdditional,
    }).forEach(([key, setFunc]) => {
      const d = params.get(key);
      if (d) {
        setFunc(d);
      }
    });
    setUrlParsed(true);
  }, [
    setUrlParsed,
    setName,
    setEngName,
    setPosition,
    setEngPosition,
    setCompany,
    setEngCompany,
    setAddress,
    setAdditional,
  ]);

  // Update sharing URL base on state (timeout?)
  useEffect(() => {
    const pars = new URLSearchParams();
    Object.entries({
      name,
      engName,
      position,
      engPosition,
      company,
      engCompany,
      address,
      additional,
    }).forEach(([key, value]) => {
      pars.append(key, value);
    });
    setSharingUrl(
      window.location.origin + window.location.pathname + "?" + pars.toString(),
    );
  }, [
    name,
    engName,
    position,
    engPosition,
    company,
    engCompany,
    address,
    additional,
  ]);

  return (
    <>
      <Header />
      <div className="container">
        {/* <ScaleLabel scale={scale}></ScaleLabel>
        <ScaleController scale={scale} setScale={setScale}></ScaleController> */}
        <CardContainer ref={cardRef} scale={scale} {...packParams} />
        {scale <= 1.3 && (
          <p className="info">
            Warning! Small Scale might violate the minimum font size set in
            Browser. Do not use these size to create image data. Will not be
            affect in print mode.
          </p>
        )}

        <label>
          Share Link
          <input
            type="text"
            className="rounded-lg bg-neutral-100 px-4 py-2 focus-within:bg-neutral-50"
            value={sharingUrl}
            id="sharingUrl"
            onFocus={(e) => {
              e.preventDefault();
              const { target } = e;
              target.focus();
              target.setSelectionRange(0, target.value.length);
              // Need Refactor
            }}
          />
        </label>
        <label>
          Show Form
          <Checkbox
            checked={showForm}
            onCheckedChange={(e) => {
              setShowForm(!!e);
            }}
            color="secondary"
          />
        </label>
        {/* Form Area */}
        <p className="info">
          Card Data will be changed immediately after these forms. While the
          image data below will not change unless you press "update image"
          button or change the image size in 3D model box.
        </p>
        {urlParsed && (
          <form className="input-form">
            {Object.entries(formData).map(([fieldName, fieldset]) => {
              return (
                <fieldset key={`field-${fieldName}`}>
                  <legend>{fieldName}</legend>
                  {Object.entries(fieldset).map(
                    ([label, { value, handle, ...options }]) => {
                      return (
                        <label className="flex flex-col">
                          {label}
                          <textarea
                            className="rounded-lg bg-neutral-100 px-4 py-2 focus-within:bg-neutral-50"
                            defaultValue={value}
                            id={label}
                            onChange={(e) => handle(e.currentTarget.value)}
                            key={`input-${label}`}
                            {...options}
                          />
                        </label>
                      );
                    },
                  )}
                </fieldset>
              );
            })}
          </form>
        )}

        <h2>3D Preview</h2>
        <model-viewer
          camera-controls
          id="card-model"
          src={cardModel}
          class="card-viewer"
        >
          <div className="image-preview">
            <span>Image Data</span>
            <img
              alt="Business Card Preview"
              width="200px"
              height="120px"
              src={cardImg}
              title="Image Data create from webpage"
            />
            <div className="update-btn">
              <button
                disabled={updating}
                onClick={handleUpdateImageClick}
                children="Update Image"
              />
              {updating && <Loader2Icon size={24} />}
            </div>
            <label>
              Resolution
              <input
                type="number"
                style={{
                  backgroundColor: "white",
                  marginTop: "1rem",
                  borderRadius: "10px",
                }}
                value={imageSize}
                id="imageSize"
                onChange={(e) => setImageSize(+e.currentTarget.value)}
              />
            </label>
          </div>
        </model-viewer>
        {/* <Markdown className="description" children={mdDesc} /> */}
      </div>

      {/* <footer>
        <SocialMedia />
      </footer> */}
    </>
  );
};

const getSizeStyle = (scale = 1.0) => {
  return {
    fontSize: `${2.5 * scale}mm`,
    width: `${90 * scale}mm`,
    height: `${54 * scale}mm`,
  };
};
const ADDITIONAL = [
  "user@example.com",
  "Tel: (01) 2345-6789",
  "Fax: (09) 8765-4321#0909",
  "M: +81-234-567-890",
  "統一編號：01234567",
].join("\n");
const CardContainer = forwardRef<
  HTMLDivElement,
  {
    name: string;
    engName: string;
    position: string;
    engPosition: string;
    company: string;
    engCompany: string;
    address: string;
    additional: string;
    scale: number;
  }
>(
  (
    {
      name = "王大明",
      engName = "Daming, Wang",
      position = "無線網路最佳化實驗室\n行政助理",
      engPosition = "Admistrator Assistance",
      company = "某一家很厲害的有限公司",
      engCompany = "Useful Co. Ltd.",
      address = "天龍國龍山市養鱒路三段礎幽街\n135 號 7 樓",
      additional = ADDITIONAL,
      scale = 1,
      ...props
    },
    ref,
  ) => {
    const extra = scale
      ? {
          style: getSizeStyle(scale),
        }
      : {};
    return (
      <div className="card-wrapper" {...props}>
        <div className="card-container" {...extra} ref={ref}>
          <div className="card-self">
            <p>{name}</p>
            <p>{engName}</p>
            <p>{position}</p>
            <p>{engPosition}</p>
          </div>
          <div className="card-detail">
            <h1>{engCompany}</h1>
            <h2>{company}</h2>
            <address className="addr">
              <p>{address}</p>
              {additional?.split(/\r?\n/).map((v) => <p key={v}>{v}</p>)}
            </address>
          </div>
        </div>
      </div>
    );
  },
);
