import cv2
import numpy as np

img = cv2.imread('/Users/srujan/.gemini/antigravity/brain/9000a733-d48c-4eea-9476-4cee67f9ec0c/.user_uploaded/media_1791264415483.jpg')
pts_outer = np.array([[310,390], [360,300], [440,270], [480,310], [620,360], [640,370], [560,600], [400,540], [360,460]], np.int32)
pts_inner = np.array([[470,400], [570,440], [530,560], [430,520]], np.int32)

pts_outer = pts_outer.reshape((-1, 1, 2))
pts_inner = pts_inner.reshape((-1, 1, 2))

cv2.polylines(img, [pts_outer], True, (0, 255, 255), 2)
cv2.polylines(img, [pts_inner], True, (0, 255, 255), 2)

cv2.imwrite('public/test_coords.jpg', img)
